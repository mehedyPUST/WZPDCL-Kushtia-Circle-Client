import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";
import Calculation from "@/lib/models/Calculation";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

function bdDayBounds(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - BD_OFFSET_MS);
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - BD_OFFSET_MS);
  return { start, end };
}

const CIRCLE_STATIONS = [
  { id: "bottail", name: "Bottail (Kushtia)", canEdit: false, editLocked: false },
  { id: "bheramara", name: "Bheramara", canEdit: true, editLocked: false },
  { id: "chuadanga", name: "Chuadanga", canEdit: true, editLocked: false },
  { id: "meherpur", name: "Meherpur", canEdit: true, editLocked: false },
  { id: "jhenaidah", name: "Jhenaidah", canEdit: true, editLocked: false },
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day") || "";
    const slot = searchParams.get("slot") || "";
    const store = getMockStore();

    let bottailCalc = null;
    if (day && slot) {
      const bounds = bdDayBounds(day);
      try {
        await connectDB();
        if (isDbConnected()) {
          bottailCalc = await Calculation.findOne({
            $and: [
              { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
              { hourSlot: slot },
              {
                $or: [
                  { calculatedAt: { $gte: bounds.start, $lt: bounds.end } },
                  { createdAt: { $gte: bounds.start, $lt: bounds.end } },
                ],
              },
            ],
          })
            .sort({ calculatedAt: -1 })
            .lean();
        } else {
          const sMs = bounds.start.getTime();
          const eMs = bounds.end.getTime();
          const matches = store.calculations.filter((d) => {
            if (d.deletedAt || d.hourSlot !== slot) return false;
            const ev = new Date(d.calculatedAt || d.createdAt).getTime();
            return !Number.isNaN(ev) && ev >= sMs && ev < eMs;
          });
          matches.sort(
            (a, b) =>
              new Date(b.calculatedAt || b.createdAt).getTime() -
              new Date(a.calculatedAt || a.createdAt).getTime()
          );
          bottailCalc = matches[0] || null;
        }
      } catch (e) {
        console.warn("[circle-sheet] DB fallback:", e.message);
      }
    }

    const totalMW = bottailCalc ? Number(bottailCalc.totalMW) || 0 : 0;
    let totalLS = 0;
    if (bottailCalc?.feeders) {
      for (const f of bottailCalc.feeders) {
        totalLS += Math.max(0, Number(f.lsMW) || 0);
      }
    }
    const allotment =
      bottailCalc?.allotment != null
        ? Number(bottailCalc.allotment)
        : totalMW + totalLS;

    const stations = CIRCLE_STATIONS.map((s) => {
      const savedEntry = store.circleEntries.get(`${day}:${slot}:${s.id}`);
      if (s.id === "bottail") {
        return {
          ...s,
          entry: savedEntry || {
            actualLoad: bottailCalc ? totalMW : null,
            loadshed: bottailCalc ? totalLS : 0,
            pgcbAllotment: bottailCalc ? allotment : null,
            pbsLoad: null,
            pbsLoadshed: null,
            pbsAllotment: null,
          },
        };
      }
      return {
        ...s,
        entry: savedEntry || {
          actualLoad: null,
          loadshed: 0,
          pgcbAllotment: null,
          pbsLoad: null,
          pbsLoadshed: null,
          pbsAllotment: null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        day,
        slot,
        stations,
      },
    });
  } catch (err) {
    console.error("GET /api/circle-load/sheet error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to load sheet" },
      { status: 500 }
    );
  }
}
