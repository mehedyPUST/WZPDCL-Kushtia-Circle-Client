"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import { fetchCalculations } from "@/lib/api";
import { FEEDERS, BOTTAIL_11KV_IDS, LS_PROTECTED_IDS } from "@/lib/constants";
import {
  LOGSHEET_SLOTS,
  toDayKey,
  recordSlotLabel,
  formatDayLabel,
} from "@/lib/logsheetSlots";
import Link from "next/link";
import { SkeletonStatCard, SkeletonShimmer } from "./SkeletonTable";
import { useTheme } from "@/context/ThemeContext";

/* ── Numerical Formatting Helpers ── */
function formatMW(v, decimals = 1) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return (Math.round((Number(v) + Number.EPSILON) * 10 ** decimals) / 10 ** decimals).toFixed(decimals);
}

function formatKV(v) {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return "—";
  return (Math.round((Number(v) + Number.EPSILON) * 10) / 10).toFixed(1);
}

function formatPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return `${(Math.round((Number(v) + Number.EPSILON) * 10) / 10).toFixed(1)}%`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatShortDate(ymd) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* ── Date Helpers (Asia/Dhaka UTC+6) ── */
function getDhakaYmd(offsetDays = 0) {
  const d = new Date();
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const shifted = new Date(d.getTime() + OFFSET_MS);
  if (offsetDays !== 0) {
    shifted.setUTCDate(shifted.getUTCDate() - offsetDays);
  }
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDhakaMonthStart() {
  const d = new Date();
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const shifted = new Date(d.getTime() + OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

const PRESET_RANGES = [
  { id: "today", label: "Today", from: () => getDhakaYmd(0), to: () => getDhakaYmd(0) },
  { id: "yesterday", label: "Yesterday", from: () => getDhakaYmd(1), to: () => getDhakaYmd(1) },
  { id: "7d", label: "Last 7 Days", from: () => getDhakaYmd(6), to: () => getDhakaYmd(0) },
  { id: "30d", label: "Last 30 Days", from: () => getDhakaYmd(29), to: () => getDhakaYmd(0) },
  { id: "month", label: "This Month", from: getDhakaMonthStart, to: () => getDhakaYmd(0) },
  { id: "all", label: "All Time", from: () => null, to: () => null },
  { id: "custom", label: "Custom", from: () => null, to: () => null },
];

const FEEDER_PALETTE = [
  "#10b981", // emerald
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#84cc16", // lime
];

const chartTooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  fontSize: 12,
  color: "#f8fafc",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6)",
  padding: "10px 14px",
};

/** Determine operational shift from hour (0–23) */
function getShiftType(h) {
  if (h >= 17 && h < 23) return "evening"; // 17:00–23:00 Evening Peak (max stress)
  if (h >= 9 && h < 17) return "day";      // 09:00–17:00 Day Peak (commercial/industrial)
  return "offpeak";                        // 23:00–09:00 Off-Peak / Night Base Load
}

/** Check if record is an hourly reading */
function isHourlySample(r) {
  return (
    r.isHourly === true ||
    (typeof r.hourSlot === "string" && r.hourSlot.trim().length > 0)
  );
}

function hasRingActive(r) {
  if (r.hasActiveRing === true) return true;
  return (r.feeders || []).some((f) => f.ringActive === true);
}

export default function StatisticsView() {
  const { isDark } = useTheme();
  const chartGridColor = isDark ? "#334155" : "#e2e8f0";
  const chartTickColor = isDark ? "#94a3b8" : "#475569";
  const chartCategoryTickColor = isDark ? "#f1f5f9" : "#0f172a";
  const activeTooltipStyle = isDark
    ? chartTooltipStyle
    : {
        backgroundColor: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        fontSize: 12,
        color: "#0f172a",
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.14)",
        padding: "10px 14px",
      };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawRecords, setRawRecords] = useState([]);
  const [rangeId, setRangeId] = useState("7d");
  const [ringFilter, setRingFilter] = useState("all"); // 'all' | 'without' | 'with'
  const [activeTab, setActiveTab] = useState("diurnal"); // 'diurnal' | 'shifts' | 'feeders' | 'bus' | 'daily'

  // Custom date range state
  const [customFrom, setCustomFrom] = useState(() => getDhakaYmd(6));
  const [customTo, setCustomTo] = useState(() => getDhakaYmd(0));

  const activeRange = useMemo(() => {
    return PRESET_RANGES.find((r) => r.id === rangeId) || PRESET_RANGES[2];
  }, [rangeId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let from = null;
      let to = null;

      if (rangeId === "custom") {
        from = customFrom;
        to = customTo;
      } else {
        from = activeRange.from();
        to = activeRange.to();
      }

      const opts = { limit: "all" };
      if (from) opts.from = from;
      if (to) opts.to = to;

      const res = await fetchCalculations(opts);
      setRawRecords(res.data || []);
    } catch (err) {
      setError(err?.message || "Failed to load station calculations");
      setRawRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeRange, rangeId, customFrom, customTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Core Processing & Substation Intelligence ── */
  const analytics = useMemo(() => {
    // Filter ring condition
    let pool = rawRecords.filter((r) => (Number(r.totalMW) || 0) > 0.001);
    if (ringFilter === "with") pool = pool.filter(hasRingActive);
    if (ringFilter === "without") pool = pool.filter((r) => !hasRingActive(r));

    if (!pool.length) {
      return {
        empty: true,
        sampleCount: 0,
        hourlyCount: 0,
        uniqueDays: 0,
      };
    }

    const hourly = pool.filter(isHourlySample);

    // Aggregates
    let peakDemand = 0;
    let peakDemandRecord = null;
    let peakSupplied = 0;
    let peakSuppliedRecord = null;
    let minSupplied = Infinity;
    let minSuppliedRecord = null;
    let peakLs = 0;
    let peakLsRecord = null;

    let sumSuppliedMW = 0;
    let sumDemandMW = 0;
    let sumLsMW = 0;

    let bottailPeak = 0;
    let bottailSum = 0;

    // Bus voltage & load tallies
    let bus1VoltSum = 0;
    let bus1VoltCount = 0;
    let bus2VoltSum = 0;
    let bus2VoltCount = 0;
    let bus1MinVolt = Infinity;
    let bus1MaxVolt = 0;
    let bus2MinVolt = Infinity;
    let bus2MaxVolt = 0;

    let bus1MWSum = 0;
    let bus2MWSum = 0;

    // Shift aggregations
    const shifts = {
      evening: { name: "Evening Peak", time: "17:00 – 23:00", count: 0, sumMW: 0, sumLS: 0, peakMW: 0, peakLS: 0 },
      day: { name: "Day Peak", time: "09:00 – 17:00", count: 0, sumMW: 0, sumLS: 0, peakMW: 0, peakLS: 0 },
      offpeak: { name: "Off-Peak / Night", time: "23:00 – 09:00", count: 0, sumMW: 0, sumLS: 0, peakMW: 0, peakLS: 0 },
    };

    // Feeder breakdowns
    const feederMap = {};
    FEEDERS.forEach((f) => {
      feederMap[f.id] = {
        id: f.id,
        name: f.name,
        bus: f.bus,
        isProtected: LS_PROTECTED_IDS.includes(f.id),
        sumMW: 0,
        countMW: 0,
        peakMW: 0,
        sumLS: 0,
        countLS: 0,
        peakLS: 0,
      };
    });

    // Time-slot & daily maps
    const slotMap = {};
    const dayMap = {};
    let ringCount = 0;
    let hoursWithLS = 0;
    let overdrawCount = 0;

    for (const r of pool) {
      const total = Number(r.totalMW) || 0;
      const feeders = Array.isArray(r.feeders) ? r.feeders : [];
      let rowLS = 0;
      let rowBus1MW = 0;
      let rowBus2MW = 0;
      let rowBottail = 0;

      for (const f of feeders) {
        const fid = f.id;
        const mw = Number(f.mw) || 0;
        const ls = Number(f.lsMW) || 0;
        rowLS += ls;

        const bus = f.bus || (FEEDERS.find((x) => x.id === fid)?.bus);
        if (bus === 1) rowBus1MW += mw;
        else if (bus === 2) rowBus2MW += mw;

        if (BOTTAIL_11KV_IDS.includes(fid)) {
          rowBottail += mw;
        }

        if (feederMap[fid]) {
          feederMap[fid].sumMW += mw;
          feederMap[fid].countMW += 1;
          if (mw > feederMap[fid].peakMW) feederMap[fid].peakMW = mw;
          if (ls > 0) {
            feederMap[fid].sumLS += ls;
            feederMap[fid].countLS += 1;
            if (ls > feederMap[fid].peakLS) feederMap[fid].peakLS = ls;
          }
        }
      }

      if (r.bottail11kV != null && Number.isFinite(Number(r.bottail11kV))) {
        rowBottail = Number(r.bottail11kV);
      }

      const demand = total + rowLS;
      const allotment = r.allotment != null && Number.isFinite(Number(r.allotment)) ? Number(r.allotment) : null;
      if (allotment != null && total > allotment + 0.1) {
        overdrawCount += 1;
      }

      const when = r.calculatedAt || r.createdAt;
      const slot = recordSlotLabel(r) || r.hourSlot || "—";
      const day = toDayKey(when);

      // Check peaks
      if (demand > peakDemand) {
        peakDemand = demand;
        peakDemandRecord = { demand, total, ls: rowLS, when, slot, day };
      }
      if (total > peakSupplied) {
        peakSupplied = total;
        peakSuppliedRecord = { total, demand, ls: rowLS, when, slot, day };
      }
      if (total < minSupplied) {
        minSupplied = total;
        minSuppliedRecord = { total, when, slot, day };
      }
      if (rowLS > peakLs) {
        peakLs = rowLS;
        peakLsRecord = { ls: rowLS, total, when, slot, day };
      }
      if (rowBottail > bottailPeak) {
        bottailPeak = rowBottail;
      }
      if (rowLS > 0.05) {
        hoursWithLS += 1;
      }
      if (hasRingActive(r)) {
        ringCount += 1;
      }

      sumSuppliedMW += total;
      sumDemandMW += demand;
      sumLsMW += rowLS;
      bottailSum += rowBottail;
      bus1MWSum += rowBus1MW;
      bus2MWSum += rowBus2MW;

      // Bus Voltages
      const v1 = Number(r.busVoltages?.bus1) || 0;
      const v2 = Number(r.busVoltages?.bus2) || 0;
      if (v1 > 10) {
        bus1VoltSum += v1;
        bus1VoltCount += 1;
        if (v1 < bus1MinVolt) bus1MinVolt = v1;
        if (v1 > bus1MaxVolt) bus1MaxVolt = v1;
      }
      if (v2 > 10) {
        bus2VoltSum += v2;
        bus2VoltCount += 1;
        if (v2 < bus2MinVolt) bus2MinVolt = v2;
        if (v2 > bus2MaxVolt) bus2MaxVolt = v2;
      }

      // Operational Shift mapping
      const hourNum = parseInt(slot.split(":")[0], 10);
      const shiftKey = Number.isFinite(hourNum) ? getShiftType(hourNum) : "day";
      const shiftObj = shifts[shiftKey];
      shiftObj.count += 1;
      shiftObj.sumMW += total;
      shiftObj.sumLS += rowLS;
      if (total > shiftObj.peakMW) shiftObj.peakMW = total;
      if (rowLS > shiftObj.peakLS) shiftObj.peakLS = rowLS;

      // Daily grouping
      if (day) {
        if (!dayMap[day]) {
          dayMap[day] = {
            day,
            label: formatShortDate(day),
            peakDemand: 0,
            peakSupplied: 0,
            peakLS: 0,
            sumSupplied: 0,
            sumLS: 0,
            count: 0,
          };
        }
        dayMap[day].count += 1;
        dayMap[day].sumSupplied += total;
        dayMap[day].sumLS += rowLS;
        if (demand > dayMap[day].peakDemand) dayMap[day].peakDemand = demand;
        if (total > dayMap[day].peakSupplied) dayMap[day].peakSupplied = total;
        if (rowLS > dayMap[day].peakLS) dayMap[day].peakLS = rowLS;
      }

      // Diurnal slot grouping
      if (slot && slot !== "—") {
        if (!slotMap[slot]) {
          slotMap[slot] = {
            slot,
            count: 0,
            sumDemand: 0,
            sumSupplied: 0,
            sumLS: 0,
            allotmentSum: 0,
            allotmentCount: 0,
            sumV1: 0,
            v1Count: 0,
            sumV2: 0,
            v2Count: 0,
            sumBus1MW: 0,
            sumBus2MW: 0,
            latestRecord: null,
          };
        }
        slotMap[slot].count += 1;
        slotMap[slot].sumDemand += demand;
        slotMap[slot].sumSupplied += total;
        slotMap[slot].sumLS += rowLS;
        slotMap[slot].sumBus1MW += rowBus1MW;
        slotMap[slot].sumBus2MW += rowBus2MW;
        if (allotment != null) {
          slotMap[slot].allotmentSum += allotment;
          slotMap[slot].allotmentCount += 1;
        }
        if (v1 > 10) {
          slotMap[slot].sumV1 += v1;
          slotMap[slot].v1Count += 1;
        }
        if (v2 > 10) {
          slotMap[slot].sumV2 += v2;
          slotMap[slot].v2Count += 1;
        }
        slotMap[slot].latestRecord = r;
      }
    }

    // Means and percentages
    const sampleN = pool.length;
    const meanSupplied = sampleN ? sumSuppliedMW / sampleN : 0;
    const meanDemand = sampleN ? sumDemandMW / sampleN : 0;
    const meanLS = sampleN ? sumLsMW / sampleN : 0;
    const bottailMean = sampleN ? bottailSum / sampleN : 0;

    // Load factor (ratio of mean active load to peak active load)
    const loadFactor = peakSupplied > 0 ? (meanSupplied / peakSupplied) * 100 : 0;

    // Bus Voltages & Loading Share
    const bus1AvgVolt = bus1VoltCount ? bus1VoltSum / bus1VoltCount : 0;
    const bus2AvgVolt = bus2VoltCount ? bus2VoltSum / bus2VoltCount : 0;
    const totalBusMWSum = bus1MWSum + bus2MWSum;
    const bus1SharePct = totalBusMWSum > 0 ? (bus1MWSum / totalBusMWSum) * 100 : 50;
    const bus2SharePct = totalBusMWSum > 0 ? (bus2MWSum / totalBusMWSum) * 100 : 50;

    // Feeder table & bar data
    const feederList = FEEDERS.map((f, i) => {
      const data = feederMap[f.id] || {};
      const avg = data.countMW ? data.sumMW / data.countMW : 0;
      const share = meanSupplied > 0 ? (avg / meanSupplied) * 100 : 0;
      return {
        id: f.id,
        name: f.name,
        bus: f.bus,
        isProtected: LS_PROTECTED_IDS.includes(f.id),
        peakMW: data.peakMW || 0,
        avgMW: avg,
        share: Number(share.toFixed(1)),
        peakShedMW: data.peakLS || 0,
        color: FEEDER_PALETTE[i % FEEDER_PALETTE.length],
      };
    }).sort((a, b) => b.avgMW - a.avgMW);

    // Diurnal chart series (ordered by slot 00:00 → 23:00)
    const diurnalData = LOGSHEET_SLOTS.map((slotObj) => {
      const found = slotMap[slotObj.label];
      if (!found) {
        return {
          slot: slotObj.label,
          hasData: false,
          demand: null,
          supplied: null,
          ls: null,
          allotment: null,
          bus1V: null,
          bus2V: null,
          bus1MW: null,
          bus2MW: null,
        };
      }
      const c = found.count;
      const dVal = found.sumDemand / c;
      const sVal = found.sumSupplied / c;
      const lsVal = found.sumLS / c;
      const allVal = found.allotmentCount ? found.allotmentSum / found.allotmentCount : null;
      const v1 = found.v1Count ? found.sumV1 / found.v1Count : null;
      const v2 = found.v2Count ? found.sumV2 / found.v2Count : null;
      const b1 = found.sumBus1MW / c;
      const b2 = found.sumBus2MW / c;

      return {
        slot: slotObj.label,
        hasData: true,
        demand: Number(dVal.toFixed(2)),
        supplied: Number(sVal.toFixed(2)),
        ls: Number(lsVal.toFixed(2)),
        allotment: allVal != null ? Number(allVal.toFixed(1)) : null,
        bus1V: v1 != null ? Number(v1.toFixed(1)) : null,
        bus2V: v2 != null ? Number(v2.toFixed(1)) : null,
        bus1MW: Number(b1.toFixed(2)),
        bus2MW: Number(b2.toFixed(2)),
      };
    });

    // Daily trend series (purely in MW)
    const dailyData = Object.keys(dayMap)
      .sort()
      .map((k) => {
        const item = dayMap[k];
        const avg = item.count ? item.sumSupplied / item.count : 0;
        return {
          day: item.day,
          label: item.label,
          peakDemand: Number(item.peakDemand.toFixed(1)),
          peakSupplied: Number(item.peakSupplied.toFixed(1)),
          avgSupplied: Number(avg.toFixed(1)),
          peakLS: Number(item.peakLS.toFixed(1)),
          count: item.count,
        };
      });

    // Shift summary results (purely in MW)
    const shiftSummary = Object.keys(shifts).map((k) => {
      const s = shifts[k];
      const avgMW = s.count ? s.sumMW / s.count : 0;
      const avgLS = s.count ? s.sumLS / s.count : 0;
      return {
        key: k,
        name: s.name,
        time: s.time,
        count: s.count,
        avgMW: Number(avgMW.toFixed(1)),
        peakMW: Number(s.peakMW.toFixed(1)),
        avgLS: Number(avgLS.toFixed(1)),
        peakShedMW: Number(s.peakLS.toFixed(1)),
      };
    });

    return {
      empty: false,
      sampleCount: pool.length,
      hourlyCount: hourly.length,
      uniqueDays: Object.keys(dayMap).length,
      ringCount,
      overdrawCount,
      hoursWithLS,
      // Peaks
      peakDemand: Number(peakDemand.toFixed(1)),
      peakDemandRecord,
      peakSupplied: Number(peakSupplied.toFixed(1)),
      peakSuppliedRecord,
      minSupplied: minSupplied === Infinity ? 0 : Number(minSupplied.toFixed(1)),
      minSuppliedRecord,
      peakLs: Number(peakLs.toFixed(1)),
      peakLsRecord,
      // Averages
      meanDemand: Number(meanDemand.toFixed(1)),
      meanSupplied: Number(meanSupplied.toFixed(1)),
      meanLS: Number(meanLS.toFixed(1)),
      bottailPeak: Number(bottailPeak.toFixed(1)),
      bottailMean: Number(bottailMean.toFixed(1)),
      loadFactor: Number(loadFactor.toFixed(1)),
      // Bus
      bus1AvgVolt: Number(bus1AvgVolt.toFixed(1)),
      bus2AvgVolt: Number(bus2AvgVolt.toFixed(1)),
      bus1MinVolt: bus1MinVolt === Infinity ? 0 : Number(bus1MinVolt.toFixed(1)),
      bus1MaxVolt: Number(bus1MaxVolt.toFixed(1)),
      bus2MinVolt: bus2MinVolt === Infinity ? 0 : Number(bus2MinVolt.toFixed(1)),
      bus2MaxVolt: Number(bus2MaxVolt.toFixed(1)),
      bus1SharePct: Number(bus1SharePct.toFixed(1)),
      bus2SharePct: Number(bus2SharePct.toFixed(1)),
      // Series
      diurnalData,
      dailyData,
      feederList,
      shiftSummary,
    };
  }, [rawRecords, ringFilter]);

  return (
    <div className="page-frame py-2 sm:py-4 min-h-0 overflow-y-auto overscroll-contain">
      {/* ── Top Header & Substation Identity ── */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                WZPDCL Substation 33/11 kV
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-400 text-xs font-mono font-medium">Bottail Grid</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              Substation Operational Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Active power dispatch (<span className="text-emerald-400 font-semibold">Demand = Total Supplied + Load Shed</span>),
              transformer bus balance, voltage stability, and feeder loading analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-app hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-all shadow-sm"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link
              href="/loadshed"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
            >
              Load Shed Entry
            </Link>
          </div>
        </div>

        {/* ── Filter Bar: Time Horizons & Ring Toggle ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-2/60 border border-app">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 mr-1 hidden sm:inline">
              Period:
            </span>
            {PRESET_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeId(r.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${rangeId === r.id
                    ? "bg-emerald-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers (if Custom is chosen) */}
          {rangeId === "custom" && (
            <div className="flex items-center gap-2 text-xs bg-slate-800/80 px-2.5 py-1 rounded-lg border border-app">
              <label className="text-slate-400">From:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-surface-2 text-slate-200 border border-app rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-emerald-500"
              />
              <label className="text-slate-400">To:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-surface-2 text-slate-200 border border-app rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={loadData}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                Apply
              </button>
            </div>
          )}

          {/* Ring Line Toggle */}
          <div className="flex items-center gap-1 bg-elevated/60 p-1 rounded-lg border border-white/5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1.5 hidden md:inline">
              Ring:
            </span>
            {[
              { id: "all", label: "All" },
              { id: "without", label: "No Ring" },
              { id: "with", label: "Ring Only" },
            ].map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRingFilter(rf.id)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${ringFilter === rf.id
                    ? rf.id === "with"
                      ? "bg-amber-600 text-white font-semibold"
                      : "bg-slate-700 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading Skeleton ── */}
      {loading && (
        <div className="space-y-6 py-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-surface-2/60 border border-app/80 space-y-2.5">
                <SkeletonShimmer className="h-3 w-20" />
                <SkeletonShimmer className="h-7 w-28" />
                <SkeletonShimmer className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="p-5 rounded-2xl bg-surface-2/60 border border-app/80 space-y-4">
            <div className="flex items-center justify-between">
              <SkeletonShimmer className="h-4 w-40" />
              <SkeletonShimmer className="h-6 w-24" />
            </div>
            <SkeletonShimmer className="h-64 w-full rounded-xl" />
          </div>
          <SkeletonStatCard count={3} />
        </div>
      )}

      {/* ── Error Banner ── */}
      {!loading && error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-center mb-6">
          <p className="text-red-300 text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold border border-app-strong hover:bg-slate-700"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && analytics.empty && (
        <div className="rounded-2xl border border-app bg-surface-2/40 p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-slate-200">No calculation records found</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-md mx-auto leading-relaxed">
            There are no logsheet calculations recorded for the selected date range ({activeRange.label}).
            Record hourly samples in Calculator or Manual Entry.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/manual"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              Open Manual Entry
            </Link>
            <Link
              href="/calculator"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-app transition-colors"
            >
              Open Calculator
            </Link>
          </div>
        </div>
      )}

      {/* ── Main Substation Dashboard ── */}
      {!loading && !error && !analytics.empty && (
        <>
          {/* ── Automated Engineering Intelligence Bar ── */}
          <div className="rounded-xl bg-slate-50/90 dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-emerald-300/60 dark:border-emerald-500/20 p-4 mb-6 shadow-xs dark:shadow-lg dark:shadow-black/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Operational Engineering Diagnostics & Summary
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Insight 1: Peak Demand Event */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 shadow-2xs dark:shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span className="font-semibold text-[11px]">System Peak Demand</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono text-[10px] border border-purple-200 dark:border-transparent">
                      {analytics.peakDemandRecord?.slot || "—"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatMW(analytics.peakDemand)} MW
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                    {analytics.peakDemandRecord?.ls > 0 ? (
                      <>Supplied: <span className="text-slate-900 dark:text-slate-200 font-medium">{formatMW(analytics.peakDemandRecord?.total)} MW</span> + Shed: <span className="text-rose-600 dark:text-rose-400 font-semibold">{formatMW(analytics.peakDemandRecord?.ls)} MW</span></>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">100% supplied without curtailment</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 font-mono">
                  {analytics.peakDemandRecord?.day ? formatDayLabel(analytics.peakDemandRecord.day) : "—"}
                </span>
              </div>

              {/* Insight 2: Load Shedding & Curtailment */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 shadow-2xs dark:shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span className="font-semibold text-[11px]">Load Shedding Status</span>
                    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${analytics.peakLs > 0 ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-transparent" : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-transparent"
                      }`}>
                      {analytics.peakLs > 0 ? `${analytics.hoursWithLS} slots with LS` : "Zero LS"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {analytics.peakLs > 0 ? `${formatMW(analytics.peakLs)} MW Peak Cut` : "0.0 MW (Full Supply)"}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                    {analytics.peakLs > 0 ? (
                      <>Average cut: <span className="text-slate-900 dark:text-slate-200 font-mono font-medium">{formatMW(analytics.meanLS)} MW</span> across active slots</>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">100% grid demand met without curtailment</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 font-mono">
                  {analytics.peakLsRecord?.slot ? `Peak cut slot: ${analytics.peakLsRecord.slot}` : "Compliant continuous supply"}
                </span>
              </div>

              {/* Insight 3: 33/11 kV Transformer Balance */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 shadow-2xs dark:shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span className="font-semibold text-[11px]">Bus 1 vs Bus 2 Loading</span>
                    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${Math.abs(analytics.bus1SharePct - analytics.bus2SharePct) <= 10
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-transparent"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-transparent"
                      }`}>
                      {Math.abs(analytics.bus1SharePct - analytics.bus2SharePct) <= 10 ? "Balanced" : "Asymmetric"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    B1: {analytics.bus1SharePct}% · B2: {analytics.bus2SharePct}%
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                    B1 (MRS, Housing, Rajbari, H-3)
                    <br />
                    B2 (BRB, Mozompur, Campus/GIS, Kobur, T-3)
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 font-mono">
                  Δ: {formatMW(Math.abs(analytics.bus1SharePct - analytics.bus2SharePct))}% variance
                </span>
              </div>

              {/* Insight 4: 33 kV Voltage Profile */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 shadow-2xs dark:shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span className="font-semibold text-[11px]">33 kV Incoming Voltage</span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-mono text-[10px] border border-sky-200 dark:border-transparent">
                      Nominal: 33.0 kV
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    B1: {formatKV(analytics.bus1AvgVolt)} kV · B2: {formatKV(analytics.bus2AvgVolt)} kV
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                    Range: {formatKV(Math.min(analytics.bus1MinVolt, analytics.bus2MinVolt))} – {formatKV(Math.max(analytics.bus1MaxVolt, analytics.bus2MaxVolt))} kV
                    {analytics.bus1MinVolt < 30.5 || analytics.bus2MinVolt < 30.5 ? (
                      <span className="text-amber-600 dark:text-amber-400 block font-semibold">Under-voltage detected (&lt;30.5 kV)</span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 block font-medium">Voltage within stable band</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 font-mono">
                  WZPDCL Kushtia Incomer
                </span>
              </div>
            </div>
          </div>

          {/* ── Executive Metric KPI Cards (Substation Grade - Purely MW & Units) ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <SubstationKpi
              label="True Peak Demand"
              value={formatMW(analytics.peakDemand)}
              unit="MW"
              sub={`Supplied + LS (${analytics.peakDemandRecord?.slot || "—"})`}
              accent="purple"
            />
            <SubstationKpi
              label="Supplied Peak"
              value={formatMW(analytics.peakSupplied)}
              unit="MW"
              sub={`Max consumption delivered`}
              accent="emerald"
            />
            <SubstationKpi
              label="Station Mean Load"
              value={formatMW(analytics.meanSupplied)}
              unit="MW"
              sub={`Average active power dispatched`}
              accent="sky"
            />
            <SubstationKpi
              label="Peak Load Shed"
              value={formatMW(analytics.peakLs)}
              unit="MW"
              sub={analytics.hoursWithLS > 0 ? `${analytics.hoursWithLS} slots with active LS` : "Zero LS in range"}
              accent={analytics.peakLs > 0 ? "rose" : "slate"}
            />
            <SubstationKpi
              label="Load Factor"
              value={formatPct(analytics.loadFactor)}
              unit=""
              sub={`Mean ÷ Peak supplied ratio`}
              accent="amber"
            />
            <SubstationKpi
              label="H3 + T3 11kV Peak"
              value={formatMW(analytics.bottailPeak)}
              unit="MW"
              sub={`Local 11kV bus (Mean: ${formatMW(analytics.bottailMean)} MW)`}
              accent="teal"
            />
          </div>

          {/* ── Tabbed Deep Analytics Views ── */}
          <div className="mb-6">
            <div className="flex border-b border-app overflow-x-auto gap-2">
              {[
                { id: "diurnal", label: "24-Hour Load & Allotment Profile", icon: "profile" },
                { id: "shifts", label: "Operational Shifts (Peak vs Off-Peak)", icon: "shifts" },
                { id: "feeders", label: "Feeder Loading & Protection Ledger", icon: "feeders" },
                { id: "bus", label: "Bus Voltages & Transformer Balance", icon: "bus" },
                { id: "daily", label: "Daily Historical Trend", icon: "daily" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB 1: 24-HOUR DIURNAL LOAD & ALLOTMENT CURVE ── */}
          {activeTab === "diurnal" && (
            <div className="rounded-xl bg-surface-2/60 border border-app p-4 sm:p-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                    24-Hour Diurnal Load Profile & Grid Allotment
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chronological progression across 26 logsheet slots (00:00 to 23:00, including 18:30 and 19:30).
                    Visualizes <span className="text-purple-400 font-semibold">Demand</span> vs{" "}
                    <span className="text-emerald-400 font-semibold">Supplied Consumption</span> vs{" "}
                    <span className="text-amber-400 font-semibold">Grid Allotment</span>.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-purple-500/80" />
                    <span className="text-slate-300">Demand (MW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500/80" />
                    <span className="text-slate-300">Supplied (MW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-rose-500/80" />
                    <span className="text-slate-300">Load Shed (MW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-400" />
                    <span className="text-slate-300">Allotment (MW)</span>
                  </div>
                </div>
              </div>

              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.diurnalData.filter((d) => d.hasData)}
                    margin={{ top: 12, right: 12, left: -4, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="suppliedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="lsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis
                      dataKey="slot"
                      tick={{ fill: chartTickColor, fontSize: 10 }}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fill: chartTickColor, fontSize: 10 }}
                      width={44}
                      unit=" MW"
                    />
                    <Tooltip
                      contentStyle={activeTooltipStyle}
                      formatter={(v, name) => {
                        const labelMap = {
                          demand: "Total Demand",
                          supplied: "Supplied (Consumption)",
                          ls: "Load Shed (Deficit)",
                          allotment: "Grid Allotment",
                        };
                        return [`${formatMW(v)} MW`, labelMap[name] || name];
                      }}
                      labelFormatter={(label) => `Logsheet Slot: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="demand"
                      stroke="#c084fc"
                      strokeWidth={2}
                      fill="url(#demandFill)"
                      dot={{ r: 2, fill: "#c084fc" }}
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="supplied"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#suppliedFill)"
                      dot={{ r: 2.5, fill: "#10b981" }}
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ls"
                      stroke="#f43f5e"
                      strokeWidth={1.5}
                      fill="url(#lsFill)"
                      dot={false}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="allotment"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Slot Data Cards Ribbon */}
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-800/40 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400 block text-[11px]">Evening Peak Slot (19:00/20:00)</span>
                  <span className="text-white font-bold font-mono text-sm">
                    {formatMW(analytics.diurnalData.find((d) => d.slot === "19:00" || d.slot === "20:00")?.demand || 0)} MW
                  </span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">Maximum residential & commercial load</span>
                </div>
                <div className="bg-slate-800/40 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400 block text-[11px]">Day Peak Slot (13:00/14:00)</span>
                  <span className="text-white font-bold font-mono text-sm">
                    {formatMW(analytics.diurnalData.find((d) => d.slot === "13:00" || d.slot === "14:00")?.demand || 0)} MW
                  </span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">Industrial & commercial operations</span>
                </div>
                <div className="bg-slate-800/40 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400 block text-[11px]">Night Base Load (03:00)</span>
                  <span className="text-white font-bold font-mono text-sm">
                    {formatMW(analytics.diurnalData.find((d) => d.slot === "03:00")?.supplied || 0)} MW
                  </span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">Minimum nighttime grid draw</span>
                </div>
                <div className="bg-slate-800/40 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400 block text-[11px]">Peak Load Shed Slot</span>
                  <span className="text-rose-400 font-bold font-mono text-sm">
                    {formatMW(analytics.peakLs)} MW
                  </span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">
                    {analytics.peakLsRecord?.slot ? `Occurred at ${analytics.peakLsRecord.slot}` : "No shedding recorded"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: OPERATIONAL SHIFTS (Peak vs Off-Peak) ── */}
          {activeTab === "shifts" && (
            <div className="space-y-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics.shiftSummary.map((shift) => {
                  const isEvening = shift.key === "evening";
                  const isDay = shift.key === "day";
                  return (
                    <div
                      key={shift.key}
                      className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-xs ${isEvening
                          ? "bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 border-purple-200 dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900 dark:border-purple-500/30"
                          : isDay
                            ? "bg-gradient-to-br from-sky-50/80 via-white to-sky-50/30 border-sky-200 dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900 dark:border-sky-500/30"
                            : "bg-surface border-app"
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[11px] font-bold uppercase tracking-wider ${isEvening ? "text-purple-700 dark:text-purple-400" : isDay ? "text-sky-700 dark:text-sky-400" : "text-slate-700 dark:text-slate-400"
                            }`}>
                            {shift.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-transparent px-2 py-0.5 rounded">
                            {shift.time}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Peak Supplied</span>
                            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {formatMW(shift.peakMW)} <span className="text-xs text-slate-500 dark:text-slate-400">MW</span>
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Average Load</span>
                            <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200">
                              {formatMW(shift.avgMW)} <span className="text-xs text-slate-500 dark:text-slate-400">MW</span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-app grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Peak Load Shed</span>
                            <span className={`font-mono font-bold ${shift.peakShedMW > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                              {formatMW(shift.peakShedMW)} MW
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Average Shed</span>
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {formatMW(shift.avgLS)} MW
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 text-[11px] text-slate-600 dark:text-slate-500">
                        {isEvening && "Highest thermal stress on 33/11kV transformers & switchgear"}
                        {isDay && "Driven by BRB Cable Industries, MRS, and commercial shops"}
                        {!isEvening && !isDay && "Lowest ambient temperature; stable base grid conditions"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Shift Comparison Bar Chart */}
              <div className="rounded-xl bg-surface-2/60 border border-app p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-white tracking-tight mb-1">
                  Shift Load & Curtailment Comparison
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Comparison of Peak Supplied Load (MW), Mean Load (MW), and Peak Load Shed (MW) across operational shifts.
                </p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.shiftSummary} margin={{ top: 8, right: 12, left: -4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="name" tick={{ fill: chartTickColor, fontSize: 11 }} />
                      <YAxis tick={{ fill: chartTickColor, fontSize: 10 }} width={40} unit=" MW" />
                      <Tooltip contentStyle={activeTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, color: chartTickColor }} />
                      <Bar dataKey="peakMW" name="Peak Load (MW)" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="avgMW" name="Average Load (MW)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="peakShedMW" name="Peak Load Shed (MW)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: FEEDER LOADING & PROTECTION LEDGER ── */}
          {activeTab === "feeders" && (
            <div className="space-y-6 mb-6">
              {/* Feeder Bar Chart */}
              <div className="rounded-xl bg-surface-2/60 border border-app p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                      Feeder Average & Peak Power Dispatch
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ranked by mean MW delivered. Feeders on Bus 1 vs Bus 2 with protection status.
                    </p>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.feederList}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 16, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} horizontal={false} />
                      <XAxis type="number" tick={{ fill: chartTickColor, fontSize: 10 }} unit=" MW" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tick={{ fill: chartCategoryTickColor, fontSize: 11, fontWeight: 500 }}
                      />
                      <Tooltip
                        contentStyle={activeTooltipStyle}
                        formatter={(v, name, props) => {
                          if (name === "avgMW") {
                            return [
                              `${formatMW(v)} MW (${props.payload.share}% share of station)`,
                              "Mean MW",
                            ];
                          }
                          return [`${formatMW(v)} MW`, "Peak MW"];
                        }}
                      />
                      <Bar dataKey="avgMW" name="Average MW" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {analytics.feederList.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Feeder Detailed Ledger */}
              <div className="rounded-xl bg-surface-2/60 border border-app overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-app flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Feeder Technical Ledger & Load Shed Audit
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    9 Feeders Total (2 Protected, 2 Local 11kV)
                  </span>
                </div>
                <div className="overflow-x-auto relative sheet-scroll-x">
                  <table className="w-full text-left text-xs min-w-[720px]">
                    <thead className="sticky top-0 z-30 shadow-sm">
                      <tr className="text-slate-900 dark:text-slate-200 bg-slate-200 dark:bg-elevated border-b border-slate-300 dark:border-app text-[11px] uppercase tracking-wider">
                        <th
                          className="py-2.5 px-3 font-bold bg-slate-200 text-slate-900 dark:bg-elevated dark:text-slate-100 border-r border-slate-300 dark:border-app/80"
                          style={{ position: "sticky", left: 0, top: 0, zIndex: 40, boxShadow: "var(--sticky-shadow)" }}
                        >
                          Feeder Name
                        </th>
                        <th className="py-2.5 px-3 font-semibold bg-purple-100 text-purple-900 dark:bg-purple-950/75 dark:text-purple-200 border-r border-slate-300 dark:border-app/80">Source Bus</th>
                        <th className="py-2.5 px-3 font-semibold bg-teal-100 text-teal-900 dark:bg-teal-950/75 dark:text-teal-200 border-r border-slate-300 dark:border-app/80">Classification</th>
                        <th className="py-2.5 px-3 font-semibold text-right bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border-r border-slate-300 dark:border-app/80">Mean Load</th>
                        <th className="py-2.5 px-3 font-semibold text-right bg-sky-100 text-sky-900 dark:bg-sky-950/75 dark:text-sky-200 border-r border-slate-300 dark:border-app/80">Peak Load</th>
                        <th className="py-2.5 px-3 font-semibold text-right bg-amber-100 text-amber-900 dark:bg-amber-950/75 dark:text-amber-200 border-r border-slate-300 dark:border-app/80">Station Share</th>
                        <th className="py-2.5 px-3 font-semibold text-right bg-rose-100 text-rose-900 dark:bg-rose-950/75 dark:text-rose-300 border-r border-slate-300 dark:border-app/80">Peak Load Shed</th>
                        <th className="py-2.5 px-3 font-semibold text-center bg-emerald-100 text-emerald-900 dark:bg-emerald-950/75 dark:text-emerald-200">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-mono">
                      {analytics.feederList.map((f) => (
                        <tr key={f.name} className="hover:bg-slate-100/60 dark:hover:bg-white/[0.02] text-slate-800 dark:text-slate-200 transition-colors">
                          <td
                            className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-app/80 bg-slate-50 dark:bg-surface"
                            style={{ position: "sticky", left: 0, zIndex: 20, boxShadow: "var(--sticky-shadow)" }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                              <span>{f.name}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.bus === 1 ? "bg-sky-950 text-sky-400 border border-sky-800/40" : "bg-purple-950 text-purple-400 border border-purple-800/40"
                              }`}>
                              BUS-{f.bus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            {f.isProtected ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
                                </svg>
                                Protected (No LS)
                              </span>
                            ) : BOTTAIL_11KV_IDS.includes(f.id) ? (
                              <span className="text-amber-400">Local 11kV (H3+T3)</span>
                            ) : (
                              <span className="text-slate-400">33kV Outgoing (Sheddable)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {formatMW(f.avgMW)} MW
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            {formatMW(f.peakMW)} MW
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            {f.share}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {f.peakShedMW > 0 ? (
                              <span className="text-rose-400 font-bold">{formatMW(f.peakShedMW)} MW</span>
                            ) : (
                              <span className="text-slate-500">0.0 MW</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {f.isProtected ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                                Protected 100%
                              </span>
                            ) : f.peakShedMW > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800/40">
                                Shed Active
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: BUS VOLTAGES & TRANSFORMER BALANCE ── */}
          {activeTab === "bus" && (
            <div className="space-y-6 mb-6">
              {/* Bus Voltage Fluctuation Chart */}
              <div className="rounded-xl bg-surface-2/60 border border-app p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                      33 kV Bus Voltage Stability Profile
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Bus 1 & Bus 2 voltage telemetry across logsheet hours. Nominal grid target is 33.0 kV.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-sky-400" />
                      <span className="text-slate-300">Bus 1 Voltage (kV)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-purple-400" />
                      <span className="text-slate-300">Bus 2 Voltage (kV)</span>
                    </div>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={analytics.diurnalData.filter((d) => d.hasData && (d.bus1V || d.bus2V))}
                      margin={{ top: 12, right: 12, left: -4, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="slot" tick={{ fill: chartTickColor, fontSize: 10 }} minTickGap={20} />
                      <YAxis
                        domain={[28, 35]}
                        tick={{ fill: chartTickColor, fontSize: 10 }}
                        width={40}
                        unit=" kV"
                      />
                      <Tooltip contentStyle={activeTooltipStyle} />
                      <ReferenceLine y={33.0} stroke="#10b981" strokeDasharray="3 3" label={{ value: "33 kV Nominal", fill: "#10b981", fontSize: 10, position: "insideTopRight" }} />
                      <ReferenceLine y={31.0} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "31 kV Low Warning", fill: "#f43f5e", fontSize: 10, position: "insideBottomRight" }} />
                      <Line
                        type="monotone"
                        dataKey="bus1V"
                        name="Bus 1 (kV)"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="bus2V"
                        name="Bus 2 (kV)"
                        stroke="#c084fc"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bus Transformer Loading Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bus 1 Card */}
                <div className="rounded-xl bg-surface border border-sky-300/60 dark:border-sky-500/20 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                      BUS-1 Incomer & Transformers
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800/40">
                      {analytics.bus1SharePct}% of Station Load
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-app text-xs font-mono">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Average kV</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">{formatKV(analytics.bus1AvgVolt)} kV</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Minimum kV</span>
                      <span className="text-base font-bold text-slate-700 dark:text-slate-300">{formatKV(analytics.bus1MinVolt)} kV</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Maximum kV</span>
                      <span className="text-base font-bold text-slate-700 dark:text-slate-300">{formatKV(analytics.bus1MaxVolt)} kV</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-300 block mb-1">Connected Feeders:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {FEEDERS.filter((f) => f.bus === 1).map((f) => (
                        <span key={f.id} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] border border-slate-200 dark:border-transparent">
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bus 2 Card */}
                <div className="rounded-xl bg-surface border border-purple-300/60 dark:border-purple-500/20 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      BUS-2 Incomer & Transformers
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-300 dark:border-purple-800/40">
                      {analytics.bus2SharePct}% of Station Load
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-app text-xs font-mono">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Average kV</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">{formatKV(analytics.bus2AvgVolt)} kV</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Minimum kV</span>
                      <span className="text-base font-bold text-slate-700 dark:text-slate-300">{formatKV(analytics.bus2MinVolt)} kV</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Maximum kV</span>
                      <span className="text-base font-bold text-slate-700 dark:text-slate-300">{formatKV(analytics.bus2MaxVolt)} kV</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-300 block mb-1">Connected Feeders:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {FEEDERS.filter((f) => f.bus === 2).map((f) => (
                        <span key={f.id} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] border border-slate-200 dark:border-transparent">
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 5: DAILY HISTORICAL TREND (Purely MW) ── */}
          {activeTab === "daily" && (
            <div className="rounded-xl bg-surface-2/60 border border-app p-4 sm:p-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                    Daily Peak & Average Demand Trend
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Day-by-day evolution of Peak Demand (MW), Peak Supplied (MW), and Daily Mean Load (MW).
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-purple-500" />
                    <span className="text-slate-300">Peak Demand (MW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <span className="text-slate-300">Peak Supplied (MW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-sky-500" />
                    <span className="text-slate-300">Daily Average (MW)</span>
                  </div>
                </div>
              </div>

              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.dailyData} margin={{ top: 12, right: 12, left: -4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="dailyPeakFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c084fc" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="dailySuppliedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis dataKey="label" tick={{ fill: chartTickColor, fontSize: 10 }} minTickGap={20} />
                    <YAxis tick={{ fill: chartTickColor, fontSize: 10 }} width={44} unit=" MW" />
                    <Tooltip
                      contentStyle={activeTooltipStyle}
                      formatter={(v, name) => {
                        const nMap = {
                          peakDemand: "Day Peak Demand",
                          peakSupplied: "Day Peak Supplied",
                          avgSupplied: "Day Mean Load",
                          peakLS: "Day Peak Load Shed",
                        };
                        return [`${formatMW(v)} MW`, nMap[name] || name];
                      }}
                      labelFormatter={(_, payload) => {
                        const p = payload?.[0]?.payload;
                        return p ? `${p.day} · ${p.count} readings recorded` : "";
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="peakDemand"
                      stroke="#c084fc"
                      strokeWidth={2}
                      fill="url(#dailyPeakFill)"
                    />
                    <Area
                      type="monotone"
                      dataKey="peakSupplied"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#dailySuppliedFill)"
                    />
                    <Line
                      type="monotone"
                      dataKey="avgSupplied"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Engineering Context & Formula References ── */}
          <div className="rounded-xl bg-surface-2/40 border border-white/5 p-4 text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300">
              Technical Calculation Methodology (WZPDCL Standards):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] leading-relaxed">
              <div className="bg-elevated/40 p-2.5 rounded border border-white/5">
                <span className="text-emerald-400 font-bold block mb-1">True Demand (MW)</span>
                <code>Demand = Supplied (Total) + Load Shed (LS)</code>. Represents uncurtailed consumer demand.
              </div>
              <div className="bg-elevated/40 p-2.5 rounded border border-white/5">
                <span className="text-sky-400 font-bold block mb-1">Station Mean Load (MW)</span>
                <code>Mean Load = Σ (Sample MW) ÷ Total Samples</code>. Represents average power delivery.
              </div>
              <div className="bg-elevated/40 p-2.5 rounded border border-white/5">
                <span className="text-amber-400 font-bold block mb-1">Load Factor (%)</span>
                <code>LF = (Mean Load ÷ Peak Load) × 100</code>. Reflects station capacity efficiency.
              </div>
              <div className="bg-elevated/40 p-2.5 rounded border border-white/5">
                <span className="text-purple-400 font-bold block mb-1">Power Formula</span>
                <code>MW = (√3 × V_kV × 0.9 PF × I_A) ÷ 1000</code>.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SubstationKpi({ label, value, unit, sub, accent = "slate" }) {
  const accentClasses = {
    purple: "from-purple-50/90 via-white to-purple-100/40 border-purple-200 dark:from-purple-950/50 dark:via-transparent dark:to-slate-900 dark:border-purple-500/25",
    emerald: "from-emerald-50/90 via-white to-emerald-100/40 border-emerald-200 dark:from-emerald-950/50 dark:via-transparent dark:to-slate-900 dark:border-emerald-500/25",
    sky: "from-sky-50/90 via-white to-sky-100/40 border-sky-200 dark:from-sky-950/50 dark:via-transparent dark:to-slate-900 dark:border-sky-500/25",
    rose: "from-rose-50/90 via-white to-rose-100/40 border-rose-200 dark:from-rose-950/50 dark:via-transparent dark:to-slate-900 dark:border-rose-500/25",
    amber: "from-amber-50/90 via-white to-amber-100/40 border-amber-200 dark:from-amber-950/50 dark:via-transparent dark:to-slate-900 dark:border-amber-500/25",
    teal: "from-teal-50/90 via-white to-teal-100/40 border-teal-200 dark:from-teal-950/50 dark:via-transparent dark:to-slate-900 dark:border-teal-500/25",
    slate: "from-slate-50/90 via-white to-slate-100/40 border-slate-200 dark:from-slate-800/40 dark:via-transparent dark:to-slate-900 dark:border-white/[0.07]",
  };

  const valueClasses = {
    purple: "text-purple-900 dark:text-purple-200",
    emerald: "text-emerald-900 dark:text-emerald-200",
    sky: "text-sky-900 dark:text-sky-200",
    rose: "text-rose-900 dark:text-rose-200",
    amber: "text-amber-900 dark:text-amber-200",
    teal: "text-teal-900 dark:text-teal-200",
    slate: "text-slate-900 dark:text-white",
  };

  return (
    <div className={`rounded-xl border p-3.5 sm:p-4 bg-gradient-to-br ${accentClasses[accent] || accentClasses.slate} shadow-xs dark:shadow-sm flex flex-col justify-between`}>
      <div>
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          {label}
        </p>
        <p className={`mt-1.5 text-lg sm:text-xl font-bold tabular-nums tracking-tight font-mono ${valueClasses[accent] || valueClasses.slate}`}>
          {value}
          {unit ? <span className="text-xs font-sans font-medium text-slate-500 dark:text-slate-400 ml-1">{unit}</span> : null}
        </p>
      </div>
      {sub ? <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-2 leading-tight">{sub}</p> : null}
    </div>
  );
}
