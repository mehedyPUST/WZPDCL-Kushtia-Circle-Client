import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";

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
  const day = String(body.day || "");
  const slot = String(body.slot || "");
  const stationId = String(body.stationId || "");

  if (!day || !slot || !stationId) {
    return NextResponse.json(
      { success: false, message: "day, slot, and stationId are required." },
      { status: 400 }
    );
  }

  const key = `${day}::${slot}::${stationId}`;
  const store = getStore();
  const entry = {
    actualLoad: body.actualLoad == null || body.actualLoad === "" ? null : Number(body.actualLoad),
    pgcbAllotment:
      body.pgcbAllotment == null || body.pgcbAllotment === ""
        ? null
        : Number(body.pgcbAllotment),
    loadshed: body.loadshed == null || body.loadshed === "" ? 0 : Number(body.loadshed),
    pbsLoad: body.pbsLoad == null || body.pbsLoad === "" ? null : Number(body.pbsLoad),
    pbsAllotment:
      body.pbsAllotment == null || body.pbsAllotment === ""
        ? null
        : Number(body.pbsAllotment),
    pbsLoadshed:
      body.pbsLoadshed == null || body.pbsLoadshed === ""
        ? null
        : Number(body.pbsLoadshed),
    updatedByUsername: auth.user.username,
    updatedAt: new Date().toISOString(),
  };

  store.circleEntries[key] = entry;

  return NextResponse.json({
    success: true,
    data: entry,
  });
}
