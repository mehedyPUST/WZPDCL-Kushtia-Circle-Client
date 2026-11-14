import { NextRequest, NextResponse } from "next/server";
import { getStore, normalizeFeederRecord } from "@/lib/mockStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hourSlot = searchParams.get("hourSlot") || "";
  const dayStart = searchParams.get("dayStart") || "";
  const dayEnd = searchParams.get("dayEnd") || "";
  const ymd = dayStart ? dayStart.slice(0, 10) : "";

  const store = getStore();
  const match = store.calculations.find((c) => {
    if (c.deleted) return false;
    if (hourSlot && c.hourSlot !== hourSlot) return false;
    if (dayStart && dayEnd) {
      const ts = new Date(c.createdAt).getTime();
      const s = new Date(dayStart).getTime();
      const e = new Date(dayEnd).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && ts >= s && ts <= e) return true;
    }
    return ymd ? c.date === ymd : false;
  });

  return NextResponse.json({
    success: true,
    exists: Boolean(match),
    data: match ? normalizeFeederRecord(match) : null,
  });
}
