import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentShiftInfo,
  recordLoadShedMW,
  computeDashboardMetrics,
  filterDashboardRows,
  type DashboardCalcRow,
} from "./dashboardStats";

test("getCurrentShiftInfo maps Asia/Dhaka hours to A, B, and C shifts", () => {
  // 10:00 Dhaka = 04:00 UTC -> Shift A (09:00-14:00)
  const shiftA = getCurrentShiftInfo(new Date("2026-11-12T04:00:00.000Z"));
  assert.equal(shiftA.id, "A");
  assert.equal(shiftA.label, "A Shift");

  // 18:00 Dhaka = 12:00 UTC -> Shift B (15:00-20:00)
  const shiftB = getCurrentShiftInfo(new Date("2026-11-12T12:00:00.000Z"));
  assert.equal(shiftB.id, "B");

  // 02:00 Dhaka = 20:00 UTC previous day -> Shift C (21:00-08:00)
  const shiftC = getCurrentShiftInfo(new Date("2026-11-11T20:00:00.000Z"));
  assert.equal(shiftC.id, "C");
});

test("recordLoadShedMW sums positive feeder lsMW values cleanly", () => {
  const row: DashboardCalcRow = {
    _id: "r1",
    feeders: [
      { id: 1, mw: 8.2, lsMW: 0 },
      { id: 3, mw: 6.4, lsMW: 1.5 },
      { id: 4, mw: 5.1, lsMW: 0.7 },
    ],
  };
  assert.equal(recordLoadShedMW(row), 2.2);
});

test("computeDashboardMetrics aggregates today slots, peak, average, and recent trend", () => {
  const rows: DashboardCalcRow[] = [
    {
      _id: "a",
      totalMW: 42.6,
      hourSlot: "19:00",
      isHourly: true,
      calculatedAt: "2026-11-12T13:00:00.000Z", // 19:00 Dhaka (2026-11-12)
      feeders: [{ id: 3, mw: 10, lsMW: 2.5 }],
    },
    {
      _id: "b",
      totalMW: 38.4,
      hourSlot: "18:00",
      isHourly: true,
      calculatedAt: "2026-11-12T12:00:00.000Z", // 18:00 Dhaka (2026-11-12)
      feeders: [],
    },
    {
      _id: "c",
      totalMW: 36.0,
      hourSlot: "17:00",
      isHourly: true,
      calculatedAt: "2026-11-11T11:00:00.000Z", // 17:00 Dhaka (previous day)
      feeders: [],
    },
  ];

  const metrics = computeDashboardMetrics(rows, 14, "2026-11-12");
  assert.equal(metrics.totalMine, 14);
  assert.equal(metrics.todayCount, 2);
  assert.equal(metrics.todaySlotsCount, 2);
  assert.equal(metrics.hourlyCount, 3);
  assert.equal(metrics.peakMw, "42.6");
  assert.equal(metrics.avgMw, "39.0");
  assert.equal(metrics.latestMw, "42.6");
  assert.equal(metrics.latestLsMw, 2.5);
  assert.equal(metrics.totalLsEntries, 1);
  assert.deepEqual(
    metrics.recentTrend.map((p) => p.label),
    ["17:00", "18:00", "19:00"]
  );
});

test("filterDashboardRows supports Today, Loadshed, and text query", () => {
  const rows: DashboardCalcRow[] = [
    {
      _id: "a",
      totalMW: 42.6,
      hourSlot: "19:00",
      note: "Evening peak feeders",
      calculatedAt: "2026-11-12T13:00:00.000Z",
      feeders: [{ id: 3, lsMW: 1.8 }],
    },
    {
      _id: "b",
      totalMW: 31.2,
      hourSlot: "10:00",
      note: "Morning steady",
      calculatedAt: "2026-11-11T04:00:00.000Z",
      feeders: [{ id: 3, lsMW: 0 }],
    },
  ];

  assert.equal(
    filterDashboardRows(rows, {
      filter: "today",
      query: "",
      todayYmd: "2026-11-12",
    }).length,
    1
  );
  assert.equal(
    filterDashboardRows(rows, {
      filter: "loadshed",
      query: "",
      todayYmd: "2026-11-12",
    }).length,
    1
  );
  assert.equal(
    filterDashboardRows(rows, {
      filter: "all",
      query: "morning",
      todayYmd: "2026-11-12",
    })[0]._id,
    "b"
  );
});
