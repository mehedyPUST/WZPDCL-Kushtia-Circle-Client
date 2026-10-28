"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  RefreshCw,
  BarChart3,
  Zap,
  Award,
  Layers,
  Database,
  Star,
} from "lucide-react";
import { fetchMaxLoad, fetchSettings, saveMaxLoadRingMode } from "@/lib/api";
import { FEEDERS, LS_PROTECTED_IDS } from "@/lib/constants";
import { getNearestHourSlot } from "@/lib/hourSlot";
import SkeletonTable, { SkeletonShimmer } from "./SkeletonTable";
import { useTheme } from "@/context/ThemeContext";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const RANGE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "last7days", label: "Last 7 Days" },
  { id: "lastweek", label: "Last Week" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "alltime", label: "All Time" },
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

function splitDateTime(iso) {
  if (!iso) return { date: "—", time: "—" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "—" };
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return { date, time };
}

function formatMW(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const r = Math.round((Number(v) + Number.EPSILON) * 10) / 10;
  return r.toFixed(1);
}

function formatAmps(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return String(Math.round(Number(v)));
}

/** Excel-style groups: SN + Feeder span rows; each peak is a sub-row */
function buildGroups(feederData, bottail11Peaks) {
  const groups = [];
  let sn = 1;

  for (const f of FEEDERS) {
    const hit = feederData.find((r) => r.feederId === f.id);
    const peaksRaw =
      hit?.peaks?.length
        ? hit.peaks
        : hit?.maxMW != null
          ? [{ maxMW: hit.maxMW, maxLoadAt: hit.maxLoadAt, ampsAtMax: hit.ampsAtMax, hourSlot: hit.hourSlot }]
          : [];

    const peaks = peaksRaw.map((p) => {
      const { date, time } = splitDateTime(p.maxLoadAt);
      let slot = (p.hourSlot && String(p.hourSlot).trim()) || "";
      if (!slot && p.maxLoadAt) {
        const d = new Date(p.maxLoadAt);
        if (!Number.isNaN(d.getTime())) slot = getNearestHourSlot(d).label;
      }
      return {
        amps: p.ampsAtMax,
        mw: p.maxMW,
        slot: slot || "—",
        time,
        date,
        hasActiveRing: !!p.hasActiveRing,
      };
    });

    groups.push({
      sn: sn++,
      feederId: f.id,
      name: f.name,
      bus: f.bus,
      isProtected: LS_PROTECTED_IDS.includes(f.id),
      isBottail: false,
      peaks: peaks.length > 0 ? peaks : [{ amps: null, mw: null, slot: "—", time: "—", date: "—", hasActiveRing: false }],
    });
  }

  const bRaw = Array.isArray(bottail11Peaks) ? bottail11Peaks : [];
  const bPeaks = bRaw.map((p) => {
    const { date, time } = splitDateTime(p.maxLoadAt);
    let slot = (p.hourSlot && String(p.hourSlot).trim()) || "";
    if (!slot && p.maxLoadAt) {
      const d = new Date(p.maxLoadAt);
      if (!Number.isNaN(d.getTime())) slot = getNearestHourSlot(d).label;
    }
    return {
      amps: p.ampsAtMax,
      mw: p.maxMW,
      slot: slot || "—",
      time,
      date,
      hasActiveRing: !!p.hasActiveRing,
    };
  });

  groups.push({
    sn: sn++,
    feederId: "bottail-11kv",
    name: "H3+T3",
    bus: null,
    isProtected: false,
    isBottail: true,
    peaks: bPeaks.length > 0 ? bPeaks : [{ amps: null, mw: null, slot: "—", time: "—", date: "—", hasActiveRing: false }],
  });

  return groups;
}

const RING_MODE_KEY = "ss_calc_maxload_ringMode";
const RING_MODE_USER_KEY = "ss_calc_maxload_ringMode_userSet";

/**
 * Ring filter defaults to ON ("with") and stays ON until the user turns it OFF.
 * localStorage is only trusted after an explicit user toggle (or successful DB read).
 */
function cacheRingMode(mode, { userSet = false } = {}) {
  try {
    localStorage.setItem(RING_MODE_KEY, mode);
    if (userSet) localStorage.setItem(RING_MODE_USER_KEY, "1");
  } catch {
    /* ignore */
  }
}

function readCachedRingMode() {
  if (typeof window === "undefined") return "with";
  try {
    const userSet = localStorage.getItem(RING_MODE_USER_KEY) === "1";
    const v = localStorage.getItem(RING_MODE_KEY);
    // Only honor cached OFF if the user (or DB sync) explicitly set it
    if (userSet && (v === "with" || v === "without")) return v;
  } catch {
    /* ignore */
  }
  return "with";
}

function PeakKpiCard({ label, value, unit, sub, badge, accent = "slate", icon: Icon }) {
  const accentClasses = {
    emerald: "from-emerald-50/90 via-white to-emerald-100/40 border-emerald-200 dark:from-emerald-950/55 dark:via-transparent dark:to-slate-900 dark:border-emerald-500/25",
    purple: "from-purple-50/90 via-white to-purple-100/40 border-purple-200 dark:from-purple-950/50 dark:via-transparent dark:to-slate-900 dark:border-purple-500/25",
    sky: "from-sky-50/90 via-white to-sky-100/40 border-sky-200 dark:from-sky-950/50 dark:via-transparent dark:to-slate-900 dark:border-sky-500/25",
    teal: "from-teal-50/90 via-white to-teal-100/40 border-teal-200 dark:from-teal-950/50 dark:via-transparent dark:to-slate-900 dark:border-teal-500/25",
    amber: "from-amber-50/90 via-white to-amber-100/40 border-amber-200 dark:from-amber-950/50 dark:via-transparent dark:to-slate-900 dark:border-amber-500/25",
    slate: "from-slate-50/90 via-white to-slate-100/40 border-slate-200 dark:from-slate-800/40 dark:via-transparent dark:to-slate-900 dark:border-app",
  };
  const valueColors = {
    emerald: "text-emerald-900 dark:text-emerald-200",
    purple: "text-purple-900 dark:text-purple-200",
    sky: "text-sky-900 dark:text-sky-200",
    teal: "text-teal-900 dark:text-teal-200",
    amber: "text-amber-900 dark:text-amber-200",
    slate: "text-slate-900 dark:text-white",
  };
  const iconColors = {
    emerald: "text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/80 dark:border-emerald-500/30",
    purple: "text-purple-700 bg-purple-100 border-purple-300 dark:text-purple-400 dark:bg-purple-950/80 dark:border-purple-500/30",
    sky: "text-sky-700 bg-sky-100 border-sky-300 dark:text-sky-400 dark:bg-sky-950/80 dark:border-sky-500/30",
    teal: "text-teal-700 bg-teal-100 border-teal-300 dark:text-teal-400 dark:bg-teal-950/80 dark:border-teal-500/30",
    amber: "text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-400 dark:bg-amber-950/80 dark:border-amber-500/30",
    slate: "text-slate-600 bg-slate-100 border-slate-300 dark:text-muted dark:bg-surface-3 dark:border-app",
  };

  return (
    <div
      className={`rounded-xl border p-4 bg-gradient-to-br ${
        accentClasses[accent] || accentClasses.slate
      } shadow-xs dark:shadow-sm flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-muted">
            {label}
          </p>
          {Icon ? (
            <span
              className={`w-7 h-7 rounded-lg border inline-flex items-center justify-center shrink-0 ${
                iconColors[accent] || iconColors.slate
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
          <span className={`text-xl sm:text-2xl font-bold tabular-nums tracking-tight font-mono ${valueColors[accent] || valueColors.slate}`}>
            {value}
          </span>
          {unit ? (
            <span className="text-xs font-medium text-slate-500 dark:text-muted">{unit}</span>
          ) : null}
          {badge}
        </div>
      </div>
      {sub ? (
        <div className="text-[11px] text-slate-600 dark:text-muted mt-2.5 pt-2 border-t border-slate-200/80 dark:border-white/5 leading-snug font-mono">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function MaxLoadView() {
  const { isDark } = useTheme();
  const [range, setRange] = useState("monthly");
  // Always start ON — never boot into OFF unless restored from user/DB preference below
  const [ringMode, setRingMode] = useState("with");
  const [ringPrefReady, setRingPrefReady] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(1);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [bottail11Peaks, setBottail11Peaks] = useState([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [totalPeak, setTotalPeak] = useState(null);
  const [hourlyOnly, setHourlyOnly] = useState(false);
  const [periodLabel, setPeriodLabel] = useState("");
  const [topN, setTopN] = useState(3); // 1 | 3 | 5
  /** mw = rank by calculated MW (show amps at that peak); amps = rank by amps (show MW at that peak) */
  const [peakBy, setPeakBy] = useState("mw");

  useEffect(() => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth() + 1);
    setReady(true);
  }, []);

  // Load ring preference from database (source of truth).
  // Default remains ON ("with") unless DB/user explicitly saved OFF.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSettings();
        if (cancelled) return;
        const mode = s.maxLoadRingMode === "without" ? "without" : "with";
        setRingMode(mode);
        // Treat DB value as authoritative (marks preference as intentional)
        cacheRingMode(mode, { userSet: true });
      } catch {
        // Offline / API down — use cache only if user previously set it; else stay ON
        if (!cancelled) {
          setRingMode(readCachedRingMode());
        }
      } finally {
        if (!cancelled) setRingPrefReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!ready || !ringPrefReady) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMaxLoad({ range, year, month, ringMode, peakBy });
      setRows(res.data || []);
      setBottail11Peaks(res.bottail11Peaks || []);
      setSampleCount(res.sampleCount ?? 0);
      setTotalPeak(res.totalPeak || null);
      setHourlyOnly(res.hourlyOnly === true);
      setPeriodLabel(res.label || "");
    } catch (err) {
      const msg = err?.message || "Failed to load max load data";
      setError(msg);
      setRows([]);
      setBottail11Peaks([]);
      setSampleCount(0);
      setTotalPeak(null);
      setHourlyOnly(false);
      setPeriodLabel("");
      toast.error(msg, { style: { fontWeight: "bold" } });
    } finally {
      setLoading(false);
    }
  }, [range, year, month, ringMode, peakBy, ready, ringPrefReady]);

  useEffect(() => {
    if (ready && ringPrefReady) load();
  }, [load, ready, ringPrefReady]);

  const allGroups = useMemo(() => buildGroups(rows, bottail11Peaks), [rows, bottail11Peaks]);

  const groups = useMemo(() => {
    return allGroups.map((group) => ({
      ...group,
      peaks: (group.peaks || []).slice(0, topN),
    }));
  }, [allGroups, topN]);

  // Derived read-only analytics for KPI cards & bar chart
  const overview = useMemo(() => {
    let highestFeeder = null;
    let maxFeederMwScale = 0;
    const chartData = [];

    for (const g of allGroups) {
      let best = null;
      for (const p of g.peaks || []) {
        const v = Number(p.mw);
        if (Number.isFinite(v) && v > 0 && (!best || v > Number(best.mw))) {
          best = p;
        }
      }
      const mwVal = best ? Number(formatMW(best.mw)) : 0;
      const ampVal = best?.amps != null ? Number(best.amps) : 0;
      if (!g.isBottail && mwVal > maxFeederMwScale) {
        maxFeederMwScale = mwVal;
      }
      if (!g.isBottail && best && (!highestFeeder || Number(best.mw) > Number(highestFeeder.mw))) {
        highestFeeder = {
          name: g.name,
          bus: g.bus,
          ...best,
        };
      }
      chartData.push({
        name: g.name,
        busLabel: g.isBottail ? "11kV Local" : `BUS-${g.bus}`,
        bus: g.bus,
        isBottail: g.isBottail,
        peakMW: mwVal,
        amps: best?.amps ?? null,
        slot: best?.slot || "—",
        date: best?.date || "—",
        hasActiveRing: !!best?.hasActiveRing,
      });
    }

    const bottailGroup = allGroups.find((g) => g.isBottail);
    const bottailBest = (bottailGroup?.peaks || []).reduce((acc, p) => {
      const v = Number(p.mw);
      if (Number.isFinite(v) && v > 0 && (!acc || v > Number(acc.mw))) return p;
      return acc;
    }, null);

    const scaleMax = Math.max(
      maxFeederMwScale,
      bottailBest?.mw ? Number(bottailBest.mw) : 0,
      1
    );

    return {
      highestFeeder,
      bottailBest,
      chartData,
      scaleMax,
    };
  }, [allGroups]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const list = [];
    for (let i = y; i >= y - 8; i--) list.push(i);
    return list;
  }, []);

  const peakDt = totalPeak?.maxTotalAt ? splitDateTime(totalPeak.maxTotalAt) : null;
  const peakSlot = useMemo(() => {
    if (!totalPeak?.maxTotalAt) return null;
    if (totalPeak.hourSlot) return String(totalPeak.hourSlot);
    const d = new Date(totalPeak.maxTotalAt);
    return Number.isNaN(d.getTime()) ? null : getNearestHourSlot(d).label;
  }, [totalPeak]);

  const selectClass =
    "appearance-none text-xs font-semibold bg-elevated text-secondary border border-app rounded-lg px-2.5 py-1.5 pr-7 shadow-sm hover:border-app-strong focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 cursor-pointer";

  const showMonth = range === "monthly";
  const showYear = range === "monthly" || range === "yearly";

  const handleSetRingWithout = async () => {
    if (ringMode === "without") return;
    setRingMode("without");
    cacheRingMode("without", { userSet: true });
    try {
      const saved = await saveMaxLoadRingMode("without");
      if (saved?.localOnly) return;
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("Route not found") || msg.includes("404")) return;
      toast.error(msg || "Could not save ring preference", {
        style: { fontWeight: "bold" },
      });
    }
  };

  const handleSetRingWith = async () => {
    if (ringMode === "with") return;
    setRingMode("with");
    cacheRingMode("with", { userSet: true });
    try {
      const saved = await saveMaxLoadRingMode("with");
      if (saved?.localOnly) return;
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("Route not found") || msg.includes("404")) return;
      toast.error(msg || "Could not save ring preference", {
        style: { fontWeight: "bold" },
      });
    }
  };

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
              <span className="text-faint text-xs">·</span>
              <span className="text-muted text-xs font-mono font-medium">
                Bottail Grid · Peak Demand Report
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              Maximum Load &amp; Feeder Peak Ledger
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl leading-relaxed">
              Peak ranking by{" "}
              <span className="text-emerald-400 font-semibold font-mono">
                {peakBy === "amps" ? "amps" : "MW"}
              </span>
              {" "}(paired column is the value at that same reading). Tracking across feeders and local{" "}
              <span className="text-teal-400 font-semibold font-mono">H3+T3</span>{" "}
              11 kV bus, prioritizing verified hourly &amp; evening half-hour slots.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading || !ready}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-3 text-secondary border border-app hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-all shadow-sm"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loading ? "animate-spin text-emerald-400" : "text-muted"
                }`}
              />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link
              href="/statistics"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Statistics
            </Link>
          </div>
        </div>

        {/* ── Filter Bar: Horizon Presets, Month/Year, Ring Filter & Rank Depth ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-2/60 border border-app">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-faint uppercase tracking-wider px-2 mr-0.5 hidden sm:inline">
              Period:
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {RANGE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setRange(o.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    range === o.id
                      ? "bg-emerald-600 text-white shadow-sm font-semibold"
                      : "text-muted hover:text-secondary hover:bg-white/5"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {(showMonth || showYear) && (
              <div className="flex items-center gap-1.5 pl-1 sm:pl-2 sm:border-l sm:border-app">
                {showMonth && (
                  <div className="relative">
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className={selectClass}
                      aria-label="Month"
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i + 1}>
                          {MONTH_SHORT[i]} ({String(i + 1).padStart(2, "0")})
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-[10px]">
                      ▾
                    </span>
                  </div>
                )}
                {showYear && (
                  <div className="relative">
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className={selectClass}
                      aria-label="Year"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-[10px]">
                      ▾
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ring Mode Filter */}
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2"
              role="group"
              aria-label="Ring filter"
            >
              <div className="inline-flex items-center gap-0.5 bg-elevated/90 p-1 rounded-xl border border-app shadow-inner">
                <span className="text-[10px] font-bold text-faint uppercase tracking-wider px-2 hidden sm:inline">
                  Ring
                </span>
                <button
                  type="button"
                  onClick={handleSetRingWithout}
                  title="Feeder peaks on radial / own-TX only. Excludes Mozompur↔Housing↔Campus/GIS, external rings, H3↔T3 coupler."
                  className={`min-h-[2rem] px-3 rounded-lg text-[11px] font-semibold transition-all ${
                    ringMode === "without"
                      ? "bg-slate-100 text-slate-900 shadow-sm"
                      : "text-muted hover:text-app hover:bg-white/5"
                  }`}
                >
                  No Ring
                </button>
                <button
                  type="button"
                  onClick={handleSetRingWith}
                  title="All samples including ring/coupler. Individual peaks may be shared-path. Station total & 11 kV total always use all data."
                  className={`min-h-[2rem] px-3 rounded-lg text-[11px] font-semibold transition-all ${
                    ringMode === "with"
                      ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20"
                      : "text-muted hover:text-app hover:bg-white/5"
                  }`}
                >
                  + Ring
                </button>
              </div>
              <p className="text-[10px] text-faint leading-snug max-w-xs hidden lg:block">
                <span className="text-slate-300 font-semibold">No Ring</span> radial / own-TX ·{" "}
                <span className="text-amber-400/90 font-semibold">+ Ring</span> all samples · 11 kV total always full
              </p>
            </div>

            {/* Peak metric: MW vs Amps (voltage can invert which is higher) */}
            <div
              className="inline-flex items-center gap-0.5 bg-elevated/90 p-1 rounded-xl border border-app shadow-inner"
              role="group"
              aria-label="Peak by metric"
            >
              <span className="text-[10px] font-bold text-faint uppercase tracking-wider px-2 hidden sm:inline">
                Max by
              </span>
              <button
                type="button"
                onClick={() => setPeakBy("mw")}
                title="Rank peaks by calculated MW; Amps column shows current at that MW peak"
                className={`min-h-[2rem] px-3 rounded-lg text-[11px] font-semibold transition-all ${
                  peakBy === "mw"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-muted hover:text-app hover:bg-white/5"
                }`}
              >
                MW
              </button>
              <button
                type="button"
                onClick={() => setPeakBy("amps")}
                title="Rank peaks by amps; MW column shows power at that amp peak (voltage may differ)"
                className={`min-h-[2rem] px-3 rounded-lg text-[11px] font-semibold transition-all ${
                  peakBy === "amps"
                    ? "bg-sky-500 text-slate-950 shadow-sm"
                    : "text-muted hover:text-app hover:bg-white/5"
                }`}
              >
                Amps
              </button>
            </div>

            {/* Top N Rank Depth */}
            <div
              className="flex items-center gap-1 bg-elevated/70 p-1 rounded-lg border border-app"
              role="group"
              aria-label="Top peaks"
            >
              <span className="text-[10px] font-semibold text-faint uppercase tracking-wider px-1.5 hidden md:inline">
                Depth:
              </span>
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTopN(n)}
                  title={`Show top ${n} max load${n > 1 ? "s" : ""}`}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    topN === n
                      ? "bg-sky-600 text-white font-semibold shadow-sm"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading Skeleton ── */}
      {loading && (
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-surface-2/60 border border-app/80 space-y-2.5"
              >
                <SkeletonShimmer className="h-3 w-24" />
                <SkeletonShimmer className="h-7 w-28" />
                <SkeletonShimmer className="h-3 w-36" />
              </div>
            ))}
          </div>
          <SkeletonTable rows={10} columns={7} dark />
        </div>
      )}

      {/* ── Error Banner ── */}
      {!loading && error && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-6 text-center mb-6">
          <p className="text-rose-300 text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 px-4 py-1.5 rounded-lg bg-surface-3 text-white text-xs font-semibold border border-app-strong hover:bg-slate-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && sampleCount === 0 && (
        <div className="rounded-2xl border border-app bg-surface-2/50 p-12 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-surface-3/80 border border-app flex items-center justify-center text-muted">
            <Zap className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-base font-semibold text-white">
            No peak records for {periodLabel || "this period"}
          </h2>
          <p className="text-muted text-xs sm:text-sm mt-1.5 max-w-md mx-auto leading-relaxed">
            Save hourly readings from Calculator or Manual Input, then refresh this report to inspect ranked feeder peaks.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/manual"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              Open Manual Input
            </Link>
            <Link
              href="/calculator"
              className="px-4 py-2 rounded-lg bg-surface-3 hover:bg-slate-700 text-secondary text-xs font-semibold border border-app transition-colors"
            >
              Open Calculator
            </Link>
          </div>
        </div>
      )}

      {/* ── Main Peak Report Content ── */}
      {!loading && !error && sampleCount > 0 && (
        <div className="space-y-6">
          {/* ── Executive Peak KPI Strip ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <PeakKpiCard
              label="Station Coincident Peak"
              value={totalPeak ? formatMW(totalPeak.maxTotalMW) : "—"}
              unit="MW"
              accent="emerald"
              icon={Zap}
              badge={
                totalPeak?.hasActiveRing ? (
                  <span
                    title="Peak occurred while 33 kV ring was active"
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40"
                  >
                    Ring Active
                  </span>
                ) : null
              }
              sub={
                peakDt
                  ? `${peakDt.date} · ${peakDt.time}${peakSlot ? ` (${peakSlot})` : ""}`
                  : "Maximum station total MW"
              }
            />

            <PeakKpiCard
              label="Highest Individual Feeder"
              value={overview.highestFeeder ? formatMW(overview.highestFeeder.mw) : "—"}
              unit="MW"
              accent="purple"
              icon={Award}
              badge={
                overview.highestFeeder ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30">
                    {overview.highestFeeder.name} · B{overview.highestFeeder.bus}
                  </span>
                ) : null
              }
              sub={
                overview.highestFeeder
                  ? `${formatAmps(overview.highestFeeder.amps)} A · ${overview.highestFeeder.date} (${overview.highestFeeder.slot})`
                  : "No feeder peak recorded"
              }
            />

            <PeakKpiCard
              label="H3 + T3 Local 11kV Peak"
              value={overview.bottailBest ? formatMW(overview.bottailBest.mw) : "—"}
              unit="MW"
              accent="teal"
              icon={Layers}
              badge={
                overview.bottailBest?.hasActiveRing ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                    R
                  </span>
                ) : null
              }
              sub={
                overview.bottailBest
                  ? `${formatAmps(overview.bottailBest.amps)} A combined · ${overview.bottailBest.date} (${overview.bottailBest.slot})`
                  : "Combined local 11 kV bus"
              }
            />

            <PeakKpiCard
              label="Report Sample Coverage"
              value={String(sampleCount)}
              unit="readings"
              accent="sky"
              icon={Database}
              sub={`${periodLabel || "Selected range"} · ${
                hourlyOnly ? "Hourly slots" : "All saved logs"
              } · ${ringMode === "with" ? "Ring marked" : "No-ring only"}`}
            />
          </div>

          {/* ── Rank #1 Feeder Peak Comparison Chart ── */}
          <div className="rounded-xl bg-surface-2/60 border border-app p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-app tracking-tight">
                  Rank #1 Peak MW Comparison by Feeder
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Non-coincident maximum demand recorded on each outgoing feeder during{" "}
                  <span className="text-secondary font-medium">{periodLabel || "the selected period"}</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
                  BUS-1 Feeders
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                  BUS-2 Feeders
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
                  H3+T3 (11kV)
                </span>
              </div>
            </div>

            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overview.chartData}
                  margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#1e293b" : "#e2e8f0"}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{
                      fill: isDark ? "#cbd5e1" : "#334155",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                    axisLine={{ stroke: isDark ? "#334155" : "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: isDark ? "#94a3b8" : "#475569", fontSize: 10 }}
                    axisLine={{ stroke: isDark ? "#334155" : "#cbd5e1" }}
                    tickLine={false}
                    width={46}
                    unit=" MW"
                  />
                  <Tooltip
                    cursor={{
                      fill: isDark
                        ? "rgba(148, 163, 184, 0.06)"
                        : "rgba(15, 23, 42, 0.05)",
                    }}
                    contentStyle={
                      isDark
                        ? chartTooltipStyle
                        : {
                            backgroundColor: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 10,
                            fontSize: 12,
                            color: "#0f172a",
                            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.14)",
                            padding: "10px 14px",
                          }
                    }
                    formatter={(val, _name, props) => {
                      const p = props?.payload;
                      const ringTxt = p?.hasActiveRing ? " · Ring Active (R)" : "";
                      const ampsTxt = p?.amps != null ? ` (${formatAmps(p.amps)} A)` : "";
                      return [`${formatMW(val)} MW${ampsTxt}${ringTxt}`, p?.busLabel || "Peak"];
                    }}
                    labelFormatter={(label, payload) => {
                      const p = payload?.[0]?.payload;
                      return p ? `${label} · ${p.date} · Slot ${p.slot}` : label;
                    }}
                  />
                  <Bar dataKey="peakMW" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {overview.chartData.map((entry) => {
                      const fill = entry.isBottail
                        ? "#14b8a6"
                        : entry.bus === 1
                          ? "#0ea5e9"
                          : "#a855f7";
                      return <Cell key={entry.name} fill={fill} fillOpacity={0.88} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Detailed Multi-Rank Feeder Peak Ledger Table ── */}
          <div className="rounded-xl bg-surface-2/60 border border-app overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-elevated/60 border-b border-app flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-app tracking-tight">
                  Feeder Peak Ranking Schedule (Top {topN})
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-surface-3 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-app">
                  {periodLabel || "Current Period"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400" />
                  <span>Rank #1 feeder peak</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-flex items-center justify-center px-1 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                    R
                  </span>
                  <span>33 kV ring active</span>
                </span>
                <span>
                  <strong className="text-sky-400 font-mono">Slot</strong> = nearest logsheet hour
                </span>
              </div>
            </div>

            <div className="overflow-x-auto relative sheet-scroll-x">
              <table className="w-full border-collapse text-left min-w-[680px]">
                <thead className="sticky top-0 z-30 shadow-sm">
                  <tr className="bg-slate-200 dark:bg-elevated text-slate-900 dark:text-slate-300 border-b border-slate-300 dark:border-app text-[10px] sm:text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 font-bold text-center border-r border-slate-300 dark:border-app/80 w-12 bg-indigo-100 text-indigo-900 dark:bg-indigo-950/75 dark:text-indigo-200">
                      SN
                    </th>
                    <th className="px-3.5 py-3 font-bold text-left border-r border-slate-300 dark:border-app/80 w-44 bg-purple-100 text-purple-900 dark:bg-purple-950/75 dark:text-purple-200">
                      Feeder &amp; Bus
                    </th>
                    <th className="px-2.5 py-3 font-bold text-center border-r border-slate-300 dark:border-app/80 w-16 bg-amber-100 text-amber-900 dark:bg-amber-950/75 dark:text-amber-200">
                      Rank
                    </th>
                    <th className={`px-3 py-3 font-bold text-right border-r border-slate-300 dark:border-app/80 w-28 ${
                      peakBy === "amps"
                        ? "bg-sky-700 text-white dark:bg-sky-800 dark:text-sky-100"
                        : "bg-sky-100 text-sky-900 dark:bg-sky-950/75 dark:text-sky-200"
                    }`}>
                      {peakBy === "amps" ? "Peak Amps" : "Amps @ peak"}
                    </th>
                    <th className={`px-3.5 py-3 font-bold text-left border-r border-slate-300 dark:border-app/80 w-52 ${
                      peakBy === "mw"
                        ? "bg-emerald-700 text-white dark:bg-emerald-800 dark:text-emerald-100"
                        : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300"
                    }`}>
                      {peakBy === "mw" ? "Peak MW" : "MW @ peak"}
                    </th>
                    <th className="px-3 py-3 font-bold text-center border-r border-slate-300 dark:border-app/80 w-24 bg-teal-100 text-teal-900 dark:bg-teal-950/75 dark:text-teal-300">
                      Log Slot
                    </th>
                    <th className="px-3 py-3 font-bold font-mono text-center border-r border-slate-300 dark:border-app/80 w-28 bg-slate-200 text-slate-900 dark:bg-surface-2 dark:text-app text-[11px] uppercase tracking-wider">
                      Exact Time
                    </th>
                    <th className="px-3.5 py-3 font-bold text-center w-32 bg-indigo-100 text-indigo-900 dark:bg-indigo-950/75 dark:text-indigo-200">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, gIdx) => {
                    const span = g.peaks.length;
                    let maxIdx = -1;
                    let maxVal = -Infinity;
                    g.peaks.forEach((p, i) => {
                      const v =
                        peakBy === "amps" ? Number(p.amps) : Number(p.mw);
                      if (Number.isFinite(v) && v > maxVal) {
                        maxVal = v;
                        maxIdx = i;
                      }
                    });

                    const groupTopBorder =
                      gIdx > 0 ? "border-t-2 border-app" : "";
                    const groupCellBg = g.isBottail
                      ? "bg-teal-950/25"
                      : gIdx % 2 === 0
                        ? "bg-surface-2/55"
                        : "bg-elevated/45";

                    return g.peaks.map((p, i) => {
                      const empty = p.mw == null && (p.slot === "—" || !p.slot);
                      const isTop = !empty && i === maxIdx && maxVal > 0;
                      const mwNum = Number(p.mw) || 0;
                      const pct = !empty
                        ? Math.min(100, Math.max(4, (mwNum / overview.scaleMax) * 100))
                        : 0;

                      const rowBg = isTop
                        ? g.isBottail
                          ? "bg-teal-950/35 hover:bg-teal-900/30"
                          : "bg-emerald-950/20 hover:bg-emerald-950/35"
                        : i % 2 === 1
                          ? "bg-surface-2/35 hover:bg-surface-3/45"
                          : "bg-elevated/25 hover:bg-surface-3/45";

                      const topBorder = i === 0 ? groupTopBorder : "border-t border-app/60";

                      return (
                        <tr
                          key={`${g.sn}-${i}`}
                          className={`text-xs transition-colors ${rowBg} ${topBorder}`}
                        >
                          {i === 0 && (
                            <>
                              <td
                                rowSpan={span}
                                className={`px-3 py-2.5 text-center font-mono font-bold text-muted border-r border-app/80 align-middle ${groupCellBg}`}
                              >
                                {String(g.sn).padStart(2, "0")}
                              </td>
                              <td
                                rowSpan={span}
                                className={`px-3.5 py-2.5 border-r border-app/80 align-middle ${groupCellBg}`}
                              >
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={`font-bold text-sm tracking-tight ${
                                      g.isBottail ? "text-teal-300" : "text-white"
                                    }`}
                                  >
                                    {g.name}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-1">
                                    {g.isBottail ? (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-teal-950/80 text-teal-300 border border-teal-500/30">
                                        11 kV Local Sum
                                      </span>
                                    ) : (
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${
                                          g.bus === 1
                                            ? "bg-sky-950/70 text-sky-300 border-sky-500/25"
                                            : "bg-purple-950/70 text-purple-300 border-purple-500/25"
                                        }`}
                                      >
                                        BUS-{g.bus}
                                      </span>
                                    )}
                                    {g.isProtected && (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase bg-surface-3 text-slate-300 border border-app">
                                        LS-Free
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </>
                          )}

                          {/* Rank */}
                          <td className="px-2.5 py-2 text-center font-mono border-r border-app/80">
                            {empty ? (
                              <span className="text-slate-600">—</span>
                            ) : isTop ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                #{i + 1}
                              </span>
                            ) : (
                              <span className="text-faint text-[11px] font-semibold">
                                #{i + 1}
                              </span>
                            )}
                          </td>

                          {/* Max Amps */}
                          <td
                            className={`px-3 py-2 text-right font-mono tabular-nums border-r border-app/80 ${
                              empty
                                ? "text-slate-600"
                                : isTop
                                  ? "text-white font-bold"
                                  : "text-slate-300"
                            }`}
                          >
                            {empty ? (
                              "—"
                            ) : (
                              <>
                                {formatAmps(p.amps)}
                                <span className="text-[10px] text-faint ml-1">A</span>
                              </>
                            )}
                          </td>

                          {/* Max MW + Proportional Bar */}
                          <td className="px-3.5 py-2 border-r border-app/80">
                            {empty ? (
                              <span className="font-mono text-slate-600">—</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`font-mono tabular-nums font-bold inline-flex items-center gap-1.5 ${
                                      g.isBottail
                                        ? isTop
                                          ? "text-teal-300 text-sm"
                                          : "text-teal-400/90"
                                        : isTop
                                          ? "text-emerald-300 text-sm"
                                          : "text-emerald-400/85"
                                    }`}
                                  >
                                    {formatMW(p.mw)}
                                    <span className="text-[10px] font-normal text-muted">
                                      MW
                                    </span>
                                    {isTop && (
                                      <Star
                                        className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0"
                                        aria-label="Highest peak"
                                      />
                                    )}
                                  </span>

                                  {p.hasActiveRing && (
                                    <span
                                      title="Peak from active ring record"
                                      className="inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-tight bg-amber-500/20 text-amber-300 border border-amber-500/40 leading-tight shrink-0"
                                    >
                                      R
                                    </span>
                                  )}
                                </div>

                                <div className="h-1.5 w-full rounded-full bg-surface-3/90 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      g.isBottail
                                        ? "bg-teal-400"
                                        : isTop
                                          ? "bg-emerald-400"
                                          : g.bus === 1
                                            ? "bg-sky-500/75"
                                            : "bg-purple-500/75"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Slot */}
                          <td className="px-3 py-2 text-center font-mono border-r border-slate-200 dark:border-app/80">
                            {empty ? (
                              <span className="text-muted dark:text-slate-600 font-mono">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
                                  String(p.slot).includes("30")
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                                    : isTop
                                      ? "bg-sky-100 dark:bg-sky-950/70 text-sky-900 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30"
                                      : "bg-slate-100 dark:bg-surface-3/70 text-slate-900 dark:text-secondary border border-slate-200 dark:border-white/5"
                                }`}
                              >
                                {p.slot || "—"}
                              </span>
                            )}
                          </td>

                          {/* Exact Time */}
                          <td
                            className={`px-3 py-2 text-center font-mono tabular-nums font-bold text-xs sm:text-[13px] border-r border-slate-200 dark:border-app/80 ${
                              empty
                                ? "text-muted dark:text-slate-600 font-normal"
                                : isTop
                                  ? "text-emerald-700 dark:text-emerald-300 font-extrabold"
                                  : "text-slate-900 dark:text-app"
                            }`}
                          >
                            {p.time}
                          </td>

                          {/* Date */}
                          <td
                            className={`px-3.5 py-2 text-center font-mono whitespace-nowrap ${
                              empty
                                ? "text-slate-600"
                                : isTop
                                  ? "text-secondary font-semibold"
                                  : "text-muted"
                            }`}
                          >
                            {p.date}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
