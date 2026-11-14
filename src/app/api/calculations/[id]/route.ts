import { NextRequest, NextResponse } from "next/server";
import { buildCalculationResult } from "@/lib/calculations";
import { getStore, normalizeFeederRecord } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = getStore();
  const item = store.calculations.find((c) => c.id === id || c._id === id);
  if (!item) {
    return NextResponse.json(
      { success: false, message: "Calculation not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, data: normalizeFeederRecord(item) });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(req);
  if (!auth.user) {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication required",
        code: auth.reason === "shift_cutoff" ? "SHIFT_CUTOFF" : "UNAUTHORIZED",
        cutoffAt: auth.cutoffAt ?? null,
      },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const store = getStore();
  const item = store.calculations.find((c) => c.id === id || c._id === id);
  if (!item) {
    return NextResponse.json(
      { success: false, message: "Calculation not found" },
      { status: 404 }
    );
  }

  if (body.action === "restore") {
    item.deleted = false;
    item.deletedAt = null;
    item.updatedAt = new Date().toISOString();
    return NextResponse.json({ success: true, data: normalizeFeederRecord(item) });
  }

  const bus1 = Number(body.busVoltages?.bus1 ?? body.bus1Voltage ?? item.bus1Voltage);
  const bus2 = Number(body.busVoltages?.bus2 ?? body.bus2Voltage ?? item.bus2Voltage);
  const feederAmps: Record<number, number> = { ...item.feederAmps };
  const ringActive: Record<number, boolean> = { ...item.ringActive };
  const lsMap: Record<number, number> = { ...item.loadshedMW };

  if (Array.isArray(body.feeders)) {
    for (const f of body.feeders) {
      const fid = Number(f.id);
      if (!fid) continue;
      if (f.amps != null) feederAmps[fid] = Number(f.amps);
      if (f.ring != null) ringActive[fid] = Boolean(f.ring);
      if (f.lsMW != null) lsMap[fid] = Number(f.lsMW);
    }
  } else if (body.feederAmps) {
    for (const [k, v] of Object.entries(body.feederAmps)) {
      feederAmps[Number(k)] = Number(v || 0);
    }
  }

  const calc = buildCalculationResult(
    feederAmps,
    { bus1, bus2 },
    ringActive
  );

  const feedersObj: Record<string, any> = {};
  let totalLs = 0;
  let bus1TotalMW = 0;
  let bus2TotalMW = 0;
  let bus1Amps = 0;
  let bus2Amps = 0;
  for (const f of calc.feeders) {
    const lsMW = Number(lsMap[f.id] ?? body.loadshedMW?.[f.id] ?? 0);
    totalLs += lsMW;
    if (f.bus === 1) {
      bus1TotalMW += f.mw;
      bus1Amps += f.amps;
    } else {
      bus2TotalMW += f.mw;
      bus2Amps += f.amps;
    }
    feedersObj[String(f.id)] = { ...f, lsMW };
  }

  item.bus1Voltage = bus1;
  item.bus2Voltage = bus2;
  item.busVoltages = { bus1, bus2 };
  item.feeders = feedersObj;
  item.feederAmps = Object.fromEntries(Object.entries(feederAmps));
  item.ringActive = Object.fromEntries(Object.entries(ringActive));
  item.loadshedMW = Object.fromEntries(Object.entries(lsMap));
  item.totalMW = calc.totalMW;
  item.bus1TotalMW = Number(bus1TotalMW.toFixed(2));
  item.bus2TotalMW = Number(bus2TotalMW.toFixed(2));
  item.bus1Amps = Number(bus1Amps.toFixed(1));
  item.bus2Amps = Number(bus2Amps.toFixed(1));
  item.totalAmps = Number((bus1Amps + bus2Amps).toFixed(1));
  item.bottail11TotalMW = calc.bottail11kV;
  item.totalLoadshedMW = Number(totalLs.toFixed(2));
  if (typeof body.notes === "string") item.notes = body.notes;
  item.updatedAt = new Date().toISOString();

  return NextResponse.json({ success: true, data: normalizeFeederRecord(item) });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(req);
  if (!auth.user) {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication required",
        code: auth.reason === "shift_cutoff" ? "SHIFT_CUTOFF" : "UNAUTHORIZED",
        cutoffAt: auth.cutoffAt ?? null,
      },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  const store = getStore();
  const idx = store.calculations.findIndex((c) => c.id === id || c._id === id);
  if (idx === -1) {
    return NextResponse.json(
      { success: false, message: "Calculation not found" },
      { status: 404 }
    );
  }

  if (permanent) {
    store.calculations.splice(idx, 1);
  } else {
    store.calculations[idx].deleted = true;
    store.calculations[idx].deletedAt = new Date().toISOString();
  }

  return NextResponse.json({ success: true });
}
