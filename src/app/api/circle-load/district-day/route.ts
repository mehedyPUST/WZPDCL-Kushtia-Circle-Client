import { NextRequest, NextResponse } from "next/server";
import { dhakaNowParts } from "@/lib/dutyShifts";
import { getStore } from "@/lib/mockStore";

function shiftDay(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nowParts = dhakaNowParts();
  const day = searchParams.get("day") || nowParts.ymd;
  const prevDay = shiftDay(day, -1);

  const store = getStore();
  const hours = [23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  const slots = hours.map((h) => {
    const isPreviousDay = h === 23;
    const rowDay = isPreviousDay ? prevDay : day;
    const hourSlot = `${String(h).padStart(2, "0")}:00`;
    const calc = store.calculations.find(
      (c) => !c.deleted && c.date === rowDay && (c.hourSlot === hourSlot || c.time === hourSlot)
    );
    const botEntry = store.circleEntries[`${rowDay}::${hourSlot}::bottail`];
    const bherEntry = store.circleEntries[`${rowDay}::${hourSlot}::bheramara`];

    const bCons = botEntry?.actualLoad ?? calc?.totalMW ?? null;
    const bLs = botEntry?.loadshed ?? calc?.totalLoadshedMW ?? (bCons != null ? 0 : null);
    const bAllot = botEntry?.pgcbAllotment ?? (bCons != null ? Number((bCons + (bLs || 0)).toFixed(2)) : null);
    const bDemand = bCons != null ? Number((bCons + (bLs || 0)).toFixed(2)) : null;

    const hCons = bherEntry?.actualLoad ?? null;
    const hLs = bherEntry?.loadshed ?? null;
    const hAllot = bherEntry?.pgcbAllotment ?? null;
    const hDemand = hCons != null ? Number((hCons + (hLs || 0)).toFixed(2)) : null;

    const hasAny = bCons != null || hCons != null;
    const tCons = hasAny ? Number(((bCons || 0) + (hCons || 0)).toFixed(2)) : null;
    const tLs = hasAny ? Number(((bLs || 0) + (hLs || 0)).toFixed(2)) : null;
    const tDemand = hasAny ? Number(((bDemand || 0) + (hDemand || 0)).toFixed(2)) : null;
    const tAllot = hasAny ? Number(((bAllot || 0) + (hAllot || 0)).toFixed(2)) : null;

    return {
      day: rowDay,
      hourSlot,
      isPreviousDay,
      bottail: {
        consumption: bCons,
        loadshed: bLs,
        demand: bDemand,
        allotment: bAllot,
      },
      bheramara: {
        consumption: hCons,
        loadshed: hLs,
        demand: hDemand,
        allotment: hAllot,
      },
      total: {
        consumption: tCons,
        loadshed: tLs,
        demand: tDemand,
        allotment: tAllot,
      },
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      day,
      boundary: store.settings?.districtDayBoundary || "22:00",
      slots,
    },
  });
}
