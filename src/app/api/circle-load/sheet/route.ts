import { NextRequest, NextResponse } from "next/server";
import { dhakaNowParts } from "@/lib/dutyShifts";
import { getStore } from "@/lib/mockStore";

const CIRCLE_STATIONS = [
  { id: "bottail", name: "Bottail 33/11 kV SS", autoFromCalc: true },
  { id: "kushtia", name: "Kushtia 33/11 kV SS", autoFromCalc: false },
  { id: "bheramara", name: "Bheramara 33/11 kV SS", autoFromCalc: false },
  { id: "kumarkhali", name: "Kumarkhali 33/11 kV SS", autoFromCalc: false },
  { id: "khoksha", name: "Khoksha 33/11 kV SS", autoFromCalc: false },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nowParts = dhakaNowParts();
  const day = searchParams.get("day") || nowParts.ymd;
  const slot = searchParams.get("slot") || "00:00";

  const store = getStore();
  const bottailCalc = store.calculations.find(
    (c) => !c.deleted && c.date === day && (c.hourSlot === slot || c.time === slot)
  );

  const stations = CIRCLE_STATIONS.map((st) => {
    const key = `${day}::${slot}::${st.id}`;
    const saved = store.circleEntries[key] || null;
    if (st.autoFromCalc && bottailCalc && !saved) {
      return {
        ...st,
        entry: {
          actualLoad: bottailCalc.totalMW,
          pgcbAllotment: bottailCalc.totalMW + bottailCalc.totalLoadshedMW,
          loadshed: bottailCalc.totalLoadshedMW,
          pbsLoad: null,
          pbsAllotment: null,
          pbsLoadshed: null,
        },
      };
    }
    return {
      ...st,
      entry: saved || {
        actualLoad: null,
        pgcbAllotment: null,
        loadshed: 0,
        pbsLoad: null,
        pbsAllotment: null,
        pbsLoadshed: null,
      },
    };
  });

  const relaxedSlots: string[] = Array.isArray(store.settings?.circleRelaxedSlots)
    ? store.settings.circleRelaxedSlots
    : [];

  return NextResponse.json({
    success: true,
    data: {
      day,
      slot,
      active: day === nowParts.ymd,
      isRelaxed: relaxedSlots.includes(slot),
      stations,
    },
  });
}
