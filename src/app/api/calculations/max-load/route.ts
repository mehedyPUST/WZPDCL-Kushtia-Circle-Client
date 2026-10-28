import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";
import Calculation from "@/lib/models/Calculation";
import { purgeExpiredTrash } from "@/lib/trash";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

const activeFilter = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

const VALID_RANGES = new Set([
  "today",
  "last7days",
  "lastweek",
  "monthly",
  "yearly",
  "alltime",
]);

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

function bdParts(date = new Date()) {
  const t = new Date(date.getTime() + BD_OFFSET_MS);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    dow: t.getUTCDay(),
  };
}

function bdMidnight(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - BD_OFFSET_MS);
}

function resolveRange(range, year, month) {
  const nowBd = bdParts();
  const y = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : nowBd.y;
  const m =
    Number.isFinite(month) && month >= 1 && month <= 12 ? month : nowBd.m;

  let start = null;
  let end = null;
  let label = "";

  switch (range) {
    case "today": {
      start = bdMidnight(nowBd.y, nowBd.m, nowBd.d);
      end = new Date(Date.UTC(nowBd.y, nowBd.m - 1, nowBd.d + 1, 0, 0, 0, 0) - BD_OFFSET_MS);
      label = "Today";
      break;
    }
    case "last7days": {
      end = new Date(Date.UTC(nowBd.y, nowBd.m - 1, nowBd.d + 1, 0, 0, 0, 0) - BD_OFFSET_MS);
      start = new Date(Date.UTC(nowBd.y, nowBd.m - 1, nowBd.d + 1 - 7, 0, 0, 0, 0) - BD_OFFSET_MS);
      label = "Last 7 days";
      break;
    }
    case "lastweek": {
      const daysSinceMon = nowBd.dow === 0 ? 6 : nowBd.dow - 1;
      end = new Date(Date.UTC(nowBd.y, nowBd.m - 1, nowBd.d - daysSinceMon, 0, 0, 0, 0) - BD_OFFSET_MS);
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      label = "Last week";
      break;
    }
    case "yearly": {
      start = bdMidnight(y, 1, 1);
      end = bdMidnight(y + 1, 1, 1);
      label = `Year ${y}`;
      break;
    }
    case "alltime": {
      start = null;
      end = null;
      label = "All time";
      break;
    }
    case "monthly":
    default: {
      start = bdMidnight(y, m, 1);
      end = m === 12 ? bdMidnight(y + 1, 1, 1) : bdMidnight(y, m + 1, 1);
      const names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      label = `${names[m - 1]} ${y}`;
      break;
    }
  }

  return { start, end, year: y, month: m, label, range };
}

function buildDateMatch(start, end) {
  if (!start && !end) return null;
  const range = {};
  if (start) range.$gte = start;
  if (end) range.$lt = end;
  return {
    $or: [
      { calculatedAt: range },
      { createdAt: range },
    ],
  };
}

function computeMockMaxLoad(resolved, ringMode, peakBy = "mw") {
  const store = getMockStore();
  const sMs = resolved.start ? resolved.start.getTime() : null;
  const eMs = resolved.end ? resolved.end.getTime() : null;

  const inDateRange = (doc) => {
    if (!sMs && !eMs) return true;
    const times = [doc.calculatedAt, doc.createdAt]
      .filter(Boolean)
      .map((t) => new Date(t).getTime())
      .filter((t) => !Number.isNaN(t));
    return times.some(
      (t) => (sMs == null || t >= sMs) && (eMs == null || t < eMs)
    );
  };

  const stationDocs = store.calculations.filter(
    (d) => !d.deletedAt && inDateRange(d)
  );
  const baseDocs =
    ringMode === "without"
      ? stationDocs.filter(
          (d) =>
            !d.hasActiveRing &&
            !(d.feeders || []).some((f) => f?.ringActive === true)
        )
      : stationDocs;

  const hourlyCount = baseDocs.filter(
    (d) => d.isHourly === true || (typeof d.hourSlot === "string" && d.hourSlot !== "")
  ).length;

  const byFeeder = new Map();
  for (const doc of baseDocs) {
    const eventAt = doc.calculatedAt || doc.createdAt;
    for (const f of doc.feeders || []) {
      if (f?.id == null) continue;
      if (!byFeeder.has(f.id)) {
        byFeeder.set(f.id, {
          feederId: f.id,
          name: f.name,
          bus: f.bus,
          peaks: [],
          recordCount: 0,
        });
      }
      const entry = byFeeder.get(f.id);
      entry.recordCount++;
      entry.peaks.push({
        maxMW: Number(f.mw) || 0,
        maxLoadAt: eventAt,
        ampsAtMax: Number(f.amps) || 0,
        hourSlot: doc.hourSlot || null,
        hasActiveRing: !!doc.hasActiveRing,
      });
    }
  }

  const data = [...byFeeder.values()]
    .sort((a, b) => a.feederId - b.feederId)
    .map((entry) => {
      entry.peaks.sort((a, b) => {
        if (peakBy === "amps") {
          if (b.ampsAtMax !== a.ampsAtMax) return b.ampsAtMax - a.ampsAtMax;
          if (b.maxMW !== a.maxMW) return b.maxMW - a.maxMW;
        } else {
          if (b.maxMW !== a.maxMW) return b.maxMW - a.maxMW;
          if (b.ampsAtMax !== a.ampsAtMax) return b.ampsAtMax - a.ampsAtMax;
        }
        return new Date(a.maxLoadAt || 0).getTime() - new Date(b.maxLoadAt || 0).getTime();
      });
      const top = entry.peaks.slice(0, 5);
      return {
        feederId: entry.feederId,
        name: entry.name,
        bus: entry.bus,
        maxMW: top[0]?.maxMW ?? 0,
        maxLoadAt: top[0]?.maxLoadAt ?? null,
        ampsAtMax: top[0]?.ampsAtMax ?? 0,
        recordCount: entry.recordCount,
        peaks: top,
      };
    });

  // 11 kV combined peak ignores ring filter (coupler periods count)
  const bottail11Peaks = [...stationDocs]
    .sort((a, b) => {
      const diff = (Number(b.bottail11kV) || 0) - (Number(a.bottail11kV) || 0);
      if (diff !== 0) return diff;
      return (
        new Date(a.calculatedAt || a.createdAt || 0).getTime() -
        new Date(b.calculatedAt || b.createdAt || 0).getTime()
      );
    })
    .slice(0, 5)
    .map((d) => ({
      maxMW: Number(d.bottail11kV) || 0,
      maxLoadAt: d.calculatedAt || d.createdAt,
      ampsAtMax: (d.feeders || [])
        .filter((f) => f?.id === 8 || f?.id === 9)
        .reduce((sum, f) => sum + (Number(f.amps) || 0), 0),
      hourSlot: d.hourSlot || null,
      hasActiveRing: !!d.hasActiveRing,
    }));

  const sortedStation = [...stationDocs].sort((a, b) => {
    const diff = (Number(b.totalMW) || 0) - (Number(a.totalMW) || 0);
    if (diff !== 0) return diff;
    return (
      new Date(a.calculatedAt || a.createdAt || 0).getTime() -
      new Date(b.calculatedAt || b.createdAt || 0).getTime()
    );
  });

  const topStation = sortedStation[0] || null;
  const totalPeak = topStation
    ? {
        maxTotalMW: Number(topStation.totalMW) || 0,
        maxTotalAt: topStation.calculatedAt || topStation.createdAt,
        hourSlot: topStation.hourSlot || null,
        hasActiveRing: !!topStation.hasActiveRing,
      }
    : null;

  return {
    success: true,
    range: resolved.range,
    label: resolved.label,
    ringMode,
    year: resolved.year,
    month: resolved.month,
    start: resolved.start ? resolved.start.toISOString() : null,
    end: resolved.end ? resolved.end.toISOString() : null,
    sampleCount: baseDocs.length,
    hourlyOnly: hourlyCount > 0,
    data,
    bottail11Peaks,
    totalPeak,
  };
}

export async function GET(request) {
  try {
    await connectDB();
    await purgeExpiredTrash();

    const { searchParams } = new URL(request.url);
    let range = (searchParams.get("range") || "monthly").toLowerCase();
    if (!VALID_RANGES.has(range)) range = "monthly";

    const yearQ = parseInt(searchParams.get("year") || "", 10);
    const monthQ = parseInt(searchParams.get("month") || "", 10);

    const resolved = resolveRange(range, yearQ, monthQ);

    let ringMode = (searchParams.get("ringMode") || "with").toLowerCase();
    if (!["without", "with", "all"].includes(ringMode)) ringMode = "with";
    let peakBy = (searchParams.get("peakBy") || "mw").toLowerCase();
    if (!["mw", "amps"].includes(peakBy)) peakBy = "mw";

    if (!isDbConnected()) {
      return NextResponse.json(computeMockMaxLoad(resolved, ringMode, peakBy));
    }

    const dateMatch = buildDateMatch(resolved.start, resolved.end);
    const andParts = [activeFilter];
    if (dateMatch) andParts.push(dateMatch);

    if (ringMode === "without") {
      andParts.push({
        $and: [
          {
            $or: [
              { hasActiveRing: false },
              { hasActiveRing: { $exists: false } },
              { hasActiveRing: null },
            ],
          },
          {
            $nor: [{ "feeders.ringActive": true }],
          },
        ],
      });
    }

    const baseMatch = { $and: andParts };
    const stationPeakMatch = {
      $and: [activeFilter, ...(dateMatch ? [dateMatch] : [])],
    };

    const hourlyCount = await Calculation.countDocuments({
      $and: [
        ...andParts,
        {
          $or: [
            { isHourly: true },
            { hourSlot: { $type: "string", $ne: "" } },
          ],
        },
      ],
    });

    const pipeline = [
      { $match: baseMatch },
      { $unwind: "$feeders" },
      {
        $addFields: {
          eventAt: { $ifNull: ["$calculatedAt", "$createdAt"] },
        },
      },
      {
        $addFields: {
          feederMwNum: {
            $convert: {
              input: "$feeders.mw",
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      { $sort: { feederMwNum: -1, eventAt: 1 } },
      {
        $group: {
          _id: "$feeders.id",
          name: { $first: "$feeders.name" },
          bus: { $first: "$feeders.bus" },
          peaks: {
            $push: {
              maxMW: "$feederMwNum",
              maxLoadAt: "$eventAt",
              ampsAtMax: "$feeders.amps",
              hourSlot: "$hourSlot",
              hasActiveRing: { $eq: ["$hasActiveRing", true] },
            },
          },
          recordCount: { $sum: 1 },
        },
      },
      {
        $project: {
          name: 1,
          bus: 1,
          recordCount: 1,
          peaks: { $slice: ["$peaks", 5] },
          maxMW: { $arrayElemAt: ["$peaks.maxMW", 0] },
          maxLoadAt: { $arrayElemAt: ["$peaks.maxLoadAt", 0] },
          ampsAtMax: { $arrayElemAt: ["$peaks.ampsAtMax", 0] },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await Calculation.aggregate(pipeline);

    const totalPeak = await Calculation.aggregate([
      { $match: stationPeakMatch },
      {
        $addFields: {
          eventAt: { $ifNull: ["$calculatedAt", "$createdAt"] },
          totalMWNum: {
            $convert: {
              input: "$totalMW",
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      { $sort: { totalMWNum: -1, eventAt: 1 } },
      { $limit: 1 },
      {
        $project: {
          _id: 0,
          maxTotalMW: "$totalMWNum",
          maxTotalAt: "$eventAt",
          hourSlot: 1,
          hasActiveRing: { $eq: ["$hasActiveRing", true] },
        },
      },
    ]);

    // Bottail 11 kV (H3+T3) peak: ALL samples — coupler periods included
    const bottail11Peaks = await Calculation.aggregate([
      { $match: stationPeakMatch },
      { $addFields: { eventAt: { $ifNull: ["$calculatedAt", "$createdAt"] } } },
      { $sort: { bottail11kV: -1, eventAt: 1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          maxMW: { $ifNull: ["$bottail11kV", 0] },
          maxLoadAt: "$eventAt",
          hourSlot: 1,
          hasActiveRing: { $eq: ["$hasActiveRing", true] },
          ampsAtMax: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$feeders",
                    as: "f",
                    cond: { $in: ["$$f.id", [8, 9]] },
                  },
                },
                as: "f",
                in: { $ifNull: ["$$f.amps", 0] },
              },
            },
          },
        },
      },
    ]);

    const sampleCount = await Calculation.countDocuments(baseMatch);

    return NextResponse.json({
      success: true,
      range: resolved.range,
      label: resolved.label,
      ringMode,
      peakBy,
      year: resolved.year,
      month: resolved.month,
      start: resolved.start ? resolved.start.toISOString() : null,
      end: resolved.end ? resolved.end.toISOString() : null,
      sampleCount,
      hourlyOnly: hourlyCount > 0,
      data: rows.map((r) => ({
        feederId: r._id,
        name: r.name,
        bus: r.bus,
        maxMW: r.maxMW ?? 0,
        maxLoadAt: r.maxLoadAt,
        ampsAtMax: r.ampsAtMax ?? 0,
        recordCount: r.recordCount ?? 0,
        peaks: (r.peaks || []).map((p) => ({
          maxMW: p.maxMW ?? 0,
          maxLoadAt: p.maxLoadAt,
          ampsAtMax: p.ampsAtMax ?? 0,
          hourSlot: p.hourSlot || null,
          hasActiveRing: !!p.hasActiveRing,
        })),
      })),
      bottail11Peaks: (bottail11Peaks || []).map((p) => ({
        maxMW: p.maxMW ?? 0,
        maxLoadAt: p.maxLoadAt,
        ampsAtMax: p.ampsAtMax ?? 0,
        hourSlot: p.hourSlot || null,
        hasActiveRing: !!p.hasActiveRing,
      })),
      totalPeak: totalPeak[0]
        ? {
            ...totalPeak[0],
            hasActiveRing: !!totalPeak[0].hasActiveRing,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/calculations/max-load:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to compute max load" },
      { status: 500 }
    );
  }
}
