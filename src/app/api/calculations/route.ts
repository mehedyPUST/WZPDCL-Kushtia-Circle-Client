import { NextRequest, NextResponse } from "next/server";
import { buildCalculationResult } from "@/lib/calculations";
import { getStore, normalizeFeederRecord } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  const { searchParams } = new URL(req.url);
  const trash = searchParams.get("trash") === "1";
  const mine = searchParams.get("mine") === "1";
  const date = searchParams.get("date") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const rawLimit = searchParams.get("limit") || "50";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const store = getStore();
  const inboxCount = store.calculations.filter((c) => !c.deleted).length;
  const trashCount = store.calculations.filter((c) => c.deleted).length;

  let list = store.calculations.filter((c) => (trash ? c.deleted : !c.deleted));

  if (mine && auth.user) {
    const uid = auth.user.id;
    const uname = auth.user.username.toLowerCase();
    list = list.filter(
      (c) =>
        c.createdBy === uid ||
        c.createdByUsername?.toLowerCase() === uname
    );
  }

  if (date) {
    list = list.filter((c) => c.date === date);
  } else {
    if (from) list = list.filter((c) => c.date >= from);
    if (to) list = list.filter((c) => c.date <= to);
  }

  list = [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = list.length;
  const limit = rawLimit === "all" ? Math.max(1, total) : Math.max(1, Number(rawLimit) || 50);
  const pages = Math.max(1, Math.ceil(total / limit));
  const offset = rawLimit === "all" ? 0 : (page - 1) * limit;
  const sliced = list.slice(offset, offset + limit).map(normalizeFeederRecord);

  return NextResponse.json({
    success: true,
    data: sliced,
    count: sliced.length,
    total,
    page,
    limit: rawLimit === "all" ? "all" : limit,
    pages,
    inboxCount,
    trashCount,
    isAuthenticated: Boolean(auth.user),
  });
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}));
  const store = getStore();

  // Bulk actions
  if (body.action === "empty_trash") {
    store.calculations = store.calculations.filter((c) => !c.deleted);
    return NextResponse.json({ success: true, message: "Trash emptied" });
  }

  if (body.action && Array.isArray(body.ids)) {
    const idSet = new Set(body.ids.map(String));
    const nowIso = new Date().toISOString();
    if (body.action === "purge") {
      store.calculations = store.calculations.filter((c) => !idSet.has(c.id));
    } else if (body.action === "trash") {
      for (const c of store.calculations) {
        if (idSet.has(c.id)) {
          c.deleted = true;
          c.deletedAt = nowIso;
        }
      }
    } else if (body.action === "restore") {
      for (const c of store.calculations) {
        if (idSet.has(c.id)) {
          c.deleted = false;
          c.deletedAt = null;
        }
      }
    }
    return NextResponse.json({ success: true, message: "Bulk action complete" });
  }

  // Create calculation
  const bus1 = Number(body.busVoltages?.bus1 ?? body.bus1Voltage ?? 33);
  const bus2 = Number(body.busVoltages?.bus2 ?? body.bus2Voltage ?? 33);
  const feederAmps: Record<number, number> = {};
  const ringActive: Record<number, boolean> = {};
  const lsMap: Record<number, number> = {};

  if (Array.isArray(body.feeders)) {
    for (const f of body.feeders) {
      const fid = Number(f.id);
      if (!fid) continue;
      feederAmps[fid] = Number(f.amps || 0);
      if (f.ring) ringActive[fid] = true;
      if (f.lsMW != null) lsMap[fid] = Number(f.lsMW || 0);
    }
  } else if (body.feederAmps) {
    for (const [k, v] of Object.entries(body.feederAmps)) {
      feederAmps[Number(k)] = Number(v || 0);
    }
    if (body.ringActive) {
      for (const [k, v] of Object.entries(body.ringActive)) {
        if (v) ringActive[Number(k)] = true;
      }
    }
  }

  const calc = buildCalculationResult(
    feederAmps,
    { bus1, bus2 },
    ringActive
  );

  const nowIso = new Date().toISOString();
  const dateStr = String(body.date || nowIso.slice(0, 10));
  const hourSlot = String(body.hourSlot || body.time || "00:00");
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

  const record = {
    _id: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    id: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: dateStr,
    time: String(body.time || hourSlot),
    hourSlot,
    isRegularHour: body.isRegularHour !== false,
    isSpecialSlot: body.isSpecialSlot === true,
    bus1Voltage: bus1,
    bus2Voltage: bus2,
    busVoltages: { bus1, bus2 },
    feeders: feedersObj,
    feederAmps: Object.fromEntries(
      Object.entries(feederAmps).map(([k, v]) => [k, v])
    ),
    ringActive: Object.fromEntries(
      Object.entries(ringActive).map(([k, v]) => [k, v])
    ),
    loadshedMW: Object.fromEntries(
      Object.entries(lsMap).map(([k, v]) => [k, v])
    ),
    totalMW: calc.totalMW,
    bus1TotalMW: Number(bus1TotalMW.toFixed(2)),
    bus2TotalMW: Number(bus2TotalMW.toFixed(2)),
    bus1Amps: Number(bus1Amps.toFixed(1)),
    bus2Amps: Number(bus2Amps.toFixed(1)),
    totalAmps: Number((bus1Amps + bus2Amps).toFixed(1)),
    bottail11TotalMW: calc.bottail11kV,
    totalLoadshedMW: Number(totalLs.toFixed(2)),
    notes: String(body.notes || ""),
    createdBy: auth.user.id,
    createdByUsername: auth.user.username,
    createdByDisplayName: auth.user.displayName || auth.user.username,
    createdByRole: auth.user.role,
    deleted: false,
    deletedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  record._id = record.id;

  // Replace existing slot if overwrite requested
  if (body.overwrite && dateStr && hourSlot) {
    store.calculations = store.calculations.filter(
      (c) => !(c.date === dateStr && c.hourSlot === hourSlot && !c.deleted)
    );
  }

  store.calculations.unshift(record);

  return NextResponse.json({
    success: true,
    data: normalizeFeederRecord(record),
  });
}
