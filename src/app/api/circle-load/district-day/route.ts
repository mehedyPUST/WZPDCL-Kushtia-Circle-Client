import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";
import Calculation from "@/lib/models/Calculation";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

function dayKeyNow() {
  const shifted = new Date(Date.now() + BD_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDay(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function bdDayBounds(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - BD_OFFSET_MS);
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - BD_OFFSET_MS);
  return { start, end };
}

const OPERATIONAL_SLOT_DEFS = [
  { hourSlot: "23:00", isPrev: true },
  { hourSlot: "00:00", isPrev: false },
  { hourSlot: "01:00", isPrev: false },
  { hourSlot: "02:00", isPrev: false },
  { hourSlot: "03:00", isPrev: false },
  { hourSlot: "04:00", isPrev: false },
  { hourSlot: "05:00", isPrev: false },
  { hourSlot: "06:00", isPrev: false },
  { hourSlot: "07:00", isPrev: false },
  { hourSlot: "08:00", isPrev: false },
  { hourSlot: "09:00", isPrev: false },
  { hourSlot: "10:00", isPrev: false },
  { hourSlot: "11:00", isPrev: false },
  { hourSlot: "12:00", isPrev: false },
  { hourSlot: "13:00", isPrev: false },
  { hourSlot: "14:00", isPrev: false },
  { hourSlot: "15:00", isPrev: false },
  { hourSlot: "16:00", isPrev: false },
  { hourSlot: "17:00", isPrev: false },
  { hourSlot: "18:00", isPrev: false },
  { hourSlot: "18:30", isPrev: false, isSpecial: true },
  { hourSlot: "19:00", isPrev: false },
  { hourSlot: "19:30", isPrev: false, isSpecial: true },
  { hourSlot: "20:00", isPrev: false },
  { hourSlot: "21:00", isPrev: false },
  { hourSlot: "22:00", isPrev: false },
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dayParam = String(searchParams.get("day") || "").trim();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : dayKeyNow();
    const prevDay = shiftDay(day, -1);

    const prevBounds = bdDayBounds(prevDay);
    const currBounds = bdDayBounds(day);
    const store = getMockStore();

    let calculations = [];
    try {
      await connectDB();
      if (isDbConnected()) {
        calculations = await Calculation.find({
          $and: [
            { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
            {
              $or: [
                { calculatedAt: { $gte: prevBounds.start, $lt: currBounds.end } },
                { createdAt: { $gte: prevBounds.start, $lt: currBounds.end } },
              ],
            },
          ],
        })
          .sort({ calculatedAt: 1, createdAt: 1 })
          .lean();
      } else {
        const sMs = prevBounds.start.getTime();
        const eMs = currBounds.end.getTime();
        calculations = store.calculations
          .filter((d) => {
            if (d.deletedAt) return false;
            const ev = new Date(d.calculatedAt || d.createdAt).getTime();
            return !Number.isNaN(ev) && ev >= sMs && ev < eMs;
          })
          .sort(
            (a, b) =>
              new Date(a.calculatedAt || a.createdAt).getTime() -
              new Date(b.calculatedAt || b.createdAt).getTime()
          );
      }
    } catch (dbErr) {
      console.warn("[district-day] DB query fallback:", dbErr.message);
    }

    const bottailMap = new Map();
    for (const doc of calculations) {
      const eventTime = doc.calculatedAt || doc.createdAt;
      if (!eventTime) continue;
      const shifted = new Date(new Date(eventTime).getTime() + BD_OFFSET_MS);
      const y = shifted.getUTCFullYear();
      const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
      const d = String(shifted.getUTCDate()).padStart(2, "0");
      const recordDay = `${y}-${m}-${d}`;

      let slot = (doc.hourSlot && String(doc.hourSlot).trim()) || "";
      if (!slot) {
        const h = shifted.getUTCHours();
        slot = `${String(h).padStart(2, "0")}:00`;
      }
      const key = `${recordDay}:${slot}`;

      const totalMW = Number(doc.totalMW) || 0;
      let totalLS = 0;
      for (const f of doc.feeders || []) {
        totalLS += Math.max(0, Number(f.lsMW) || 0);
      }
      const demand = totalMW + totalLS;
      const allotment =
        doc.allotment != null && Number.isFinite(Number(doc.allotment))
          ? Number(doc.allotment)
          : demand;

      bottailMap.set(key, {
        consumption: totalMW,
        loadshed: totalLS,
        demand,
        allotment,
      });
    }

    const slots = [];
    let peakDemand = 0;
    let peakDemandSlot = "—";
    let peakCons = 0;
    let peakConsSlot = "—";
    let maxLs = 0;
    let maxLsSlot = "—";

    for (const def of OPERATIONAL_SLOT_DEFS) {
      const slotDay = def.isPrev ? prevDay : day;
      const key = `${slotDay}:${def.hourSlot}`;
      const bData = bottailMap.get(key) || null;

      const bottail = {
        consumption: bData ? bData.consumption : null,
        loadshed: bData ? bData.loadshed : null,
        demand: bData ? bData.demand : null,
        allotment: bData ? bData.allotment : null,
      };

      const bheraEntry = store.circleEntries.get(
        `${slotDay}:${def.hourSlot}:bheramara`
      );
      const bheraCons =
        bheraEntry?.actualLoad != null ? Number(bheraEntry.actualLoad) : null;
      const bheraLs =
        bheraEntry?.loadshed != null ? Number(bheraEntry.loadshed) : null;
      const bheramara = {
        consumption: bheraCons,
        loadshed: bheraLs,
        demand: bheraCons != null ? bheraCons + (bheraLs || 0) : null,
        allotment:
          bheraEntry?.pgcbAllotment != null
            ? Number(bheraEntry.pgcbAllotment)
            : null,
      };

      const hasAnyCons =
        bottail.consumption != null || bheramara.consumption != null;
      const tCons = (bottail.consumption || 0) + (bheramara.consumption || 0);
      const tLs = (bottail.loadshed || 0) + (bheramara.loadshed || 0);
      const tDemand = hasAnyCons ? tCons + tLs : null;
      const tAllot =
        bottail.allotment != null || bheramara.allotment != null
          ? (bottail.allotment || (bottail.demand || 0)) +
            (bheramara.allotment || (bheramara.demand || 0))
          : tDemand;

      const total = {
        consumption: hasAnyCons ? tCons : null,
        loadshed: hasAnyCons ? tLs : null,
        demand: tDemand,
        allotment: tAllot,
      };

      if (tDemand != null && tDemand > peakDemand) {
        peakDemand = tDemand;
        peakDemandSlot = def.hourSlot;
      }
      if (hasAnyCons && tCons > peakCons) {
        peakCons = tCons;
        peakConsSlot = def.hourSlot;
      }
      if (hasAnyCons && tLs > maxLs) {
        maxLs = tLs;
        maxLsSlot = def.hourSlot;
      }

      slots.push({
        dayKey: slotDay,
        hourSlot: def.hourSlot,
        isPreviousDay: def.isPrev,
        isSpecial: def.isSpecial || false,
        bottail,
        bheramara,
        total,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        day,
        rangeLabel: `${prevDay} 23:00 → ${day} 22:00`,
        boundary: "22:00",
        summary: {
          peakDemand: peakDemand > 0 ? peakDemand : null,
          peakDemandSlot: peakDemand > 0 ? peakDemandSlot : "—",
          peakConsumption: peakCons > 0 ? peakCons : null,
          peakConsumptionSlot: peakCons > 0 ? peakConsSlot : "—",
          maxLoadshed: maxLs > 0 ? maxLs : 0,
          maxLoadshedSlot: maxLs > 0 ? maxLsSlot : "—",
        },
        slots,
      },
    });
  } catch (err) {
    console.error("GET /api/circle-load/district-day error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to load district day" },
      { status: 500 }
    );
  }
}
