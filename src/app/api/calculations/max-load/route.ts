import { NextRequest, NextResponse } from "next/server";
import { BOTTAIL_11KV_IDS, FEEDERS } from "@/lib/constants";
import { dhakaNowParts } from "@/lib/dutyShifts";
import { getStore } from "@/lib/mockStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "monthly";
  const ringMode = searchParams.get("ringMode") || "with";
  const peakBy = searchParams.get("peakBy") || "mw";
  const nowParts = dhakaNowParts();
  const [curYear, curMonth] = nowParts.ymd.split("-").map(Number);
  const year = Number(searchParams.get("year")) || curYear;
  const month = Number(searchParams.get("month")) || curMonth;

  const store = getStore();
  const active = store.calculations.filter((c) => !c.deleted);

  const feederPeaks = FEEDERS.filter((f) => !BOTTAIL_11KV_IDS.includes(f.id)).map(
    (f) => {
      const readings = active
        .map((c) => {
          const entry = c.feeders?.[String(f.id)];
          const mw = Number(entry?.mw || 0);
          const amps = Number(entry?.amps ?? c.feederAmps?.[String(f.id)] ?? 0);
          return {
            calcId: c.id,
            date: c.date,
            time: c.hourSlot || c.time,
            mw,
            amps,
            kv: f.bus === 1 ? c.bus1Voltage : c.bus2Voltage,
            ring: Boolean(entry?.ring),
            createdAt: c.createdAt,
            createdBy: c.createdByDisplayName || c.createdByUsername || "",
          };
        })
        .sort((a, b) => (peakBy === "amps" ? b.amps - a.amps : b.mw - a.mw));

      return {
        id: f.id,
        name: f.name,
        bus: f.bus,
        peaks: readings.slice(0, 5),
        maxMW: readings[0]?.mw ?? 0,
        maxAmps: readings[0]?.amps ?? 0,
      };
    }
  );

  const bottail11Peaks = FEEDERS.filter((f) => BOTTAIL_11KV_IDS.includes(f.id)).map(
    (f) => {
      const readings = active
        .map((c) => {
          const entry = c.feeders?.[String(f.id)];
          return {
            calcId: c.id,
            date: c.date,
            time: c.hourSlot || c.time,
            mw: Number(entry?.mw || 0),
            amps: Number(entry?.amps ?? c.feederAmps?.[String(f.id)] ?? 0),
          };
        })
        .sort((a, b) => (peakBy === "amps" ? b.amps - a.amps : b.mw - a.mw));
      return {
        id: f.id,
        name: f.name,
        bus: f.bus,
        peaks: readings.slice(0, 5),
        maxMW: readings[0]?.mw ?? 0,
        maxAmps: readings[0]?.amps ?? 0,
      };
    }
  );

  const sortedTotals = [...active].sort((a, b) => b.totalMW - a.totalMW);
  const topTotal = sortedTotals[0] || null;

  return NextResponse.json({
    success: true,
    range,
    label: `${year}-${String(month).padStart(2, "0")}`,
    ringMode,
    peakBy,
    year,
    month,
    sampleCount: active.length,
    hourlyOnly: true,
    data: feederPeaks,
    bottail11Peaks,
    totalPeak: topTotal
      ? {
          totalMW: topTotal.totalMW,
          totalAmps: topTotal.totalAmps,
          date: topTotal.date,
          time: topTotal.hourSlot || topTotal.time,
          createdAt: topTotal.createdAt,
        }
      : null,
  });
}
