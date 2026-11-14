"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import toast from "react-hot-toast";
import { fetchDistrictDay } from "@/lib/api";
import SkeletonTable from "./SkeletonTable";

function dayKeyNow() {
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentSlotNow() {
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + OFFSET_MS);
  const h = String(shifted.getUTCHours()).padStart(2, "0");
  return `${h}:00`;
}

function shiftDay(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function clampDay(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return dayKeyNow();
  const today = dayKeyNow();
  return ymd > today ? today : ymd;
}

function fmt(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return (Math.round((Number(n) + Number.EPSILON) * 10) / 10).toFixed(1);
}

const dayCache = new Map();

function StationMini({ title, tone, cons, ls, demand, allot }) {
  const tones = {
    blue: {
      card: "bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border-blue-200 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25",
      headBar: "border-b border-blue-200/80 dark:border-sky-500/20 bg-blue-50/60 dark:bg-sky-950/35",
      head: "text-blue-700 dark:text-sky-200",
      demand: "text-blue-800 dark:text-sky-200 bg-blue-100/70 dark:bg-sky-950/60 font-bold",
    },
    teal: {
      card: "bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25",
      headBar: "border-b border-emerald-200/80 dark:border-teal-500/20 bg-emerald-50/60 dark:bg-teal-950/35",
      head: "text-emerald-700 dark:text-teal-200",
      demand: "text-emerald-800 dark:text-teal-200 bg-emerald-100/70 dark:bg-teal-950/60 font-bold",
    },
    amber: {
      card: "bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40 border-orange-200 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25",
      headBar: "border-b border-orange-200/80 dark:border-amber-500/20 bg-orange-50/75 dark:bg-amber-950/35",
      head: "text-orange-700 dark:text-amber-200",
      demand: "text-orange-800 dark:text-amber-200 bg-orange-100/70 dark:bg-amber-950/60 font-bold",
    },
    slate: {
      card: "bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200 dark:from-emerald-950/55 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-emerald-500/25",
      headBar: "border-b border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/35",
      head: "text-emerald-700 dark:text-emerald-200",
      demand: "text-emerald-800 dark:text-emerald-200 bg-emerald-100/70 dark:bg-emerald-950/60 font-bold",
    },
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${t.card} overflow-hidden shadow-2xs`}>
      <div className={`px-2.5 py-1.5 ${t.headBar}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${t.head}`}>
          {title}
        </p>
      </div>
      <div className="grid grid-cols-4 divide-x divide-app/60">
        {[
          { label: "Consumption", value: cons },
          { label: "LS", value: ls },
          { label: "Demand", value: demand, strong: true },
          { label: "Allotment", value: allot },
        ].map((c) => (
          <div
            key={c.label}
            className={`px-1 py-1.5 text-center ${c.strong ? t.demand : "bg-transparent" }`}
          >
            <p className="text-[8px] font-semibold uppercase text-muted tracking-wide">
              {c.label}
            </p>
            <p
              className={`font-mono text-[11px] font-semibold tabular-nums ${c.strong ? "font-bold" : "text-secondary" }`}
            >
              {fmt(c.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MobileSlotCard = memo(function MobileSlotCard({
  row,
  isCurrentSlot,
}: {
  row: any;
  isCurrentSlot?: boolean;
}) {
  const b = row.bottail || {};
  const h = row.bheramara || {};
  const t = row.total || {};
  return (
    <article
      data-slot={row.hourSlot}
      className={`rounded-2xl border bg-gradient-to-br shadow-sm overflow-hidden transition-all ${
        isCurrentSlot
          ? "from-emerald-50/90 via-white to-emerald-50/40 border-emerald-400 ring-2 ring-emerald-500/40 dark:from-emerald-950/55 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-emerald-500/40"
          : row.isPreviousDay
            ? "from-purple-50/80 via-white to-purple-50/30 border-purple-200 dark:from-purple-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-purple-500/25"
            : "from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-app">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-app tabular-nums">
            {row.hourSlot}
          </span>
          {isCurrentSlot && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              now
            </span>
          )}
          {row.isPreviousDay && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300 border border-violet-300 dark:border-violet-500/30">
              prev day
            </span>
          )}
          {row.isSpecial && (
            <span className="text-[10px] text-amber-500 font-bold" title="Peak slot">★</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase text-muted">
            Total demand
          </p>
          <p className="font-mono text-sm font-bold text-accent tabular-nums">
            {fmt(t.demand)}
            <span className="text-[10px] text-muted font-semibold ml-0.5">
              MW
            </span>
          </p>
        </div>
      </div>
      <div className="p-2.5 space-y-2">
        <StationMini
          title="Bottail"
          tone="teal"
          cons={b.consumption}
          ls={b.loadshed}
          demand={b.demand}
          allot={b.allotment}
        />
        <StationMini
          title="Bheramara"
          tone="amber"
          cons={h.consumption}
          ls={h.loadshed}
          demand={h.demand}
          allot={h.allotment}
        />
        <StationMini
          title="District total"
          tone="slate"
          cons={t.consumption}
          ls={t.loadshed}
          demand={t.demand}
          allot={t.allotment}
        />
      </div>
    </article>
  );
});

const DesktopRow = memo(function DesktopRow({
  row,
  isAlt,
  isCurrentSlot,
}: {
  row: any;
  isAlt?: boolean;
  isCurrentSlot?: boolean;
}) {
  const b = row.bottail || {};
  const h = row.bheramara || {};
  const t = row.total || {};
  const prev = row.isPreviousDay;

  const base = isCurrentSlot
    ? "bg-emerald-100/40 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-500/50 font-medium"
    : prev
      ? isAlt
        ? "bg-violet-50/70 dark:bg-violet-950/40"
        : "bg-violet-50/40 dark:bg-violet-950/25"
      : isAlt
        ? "bg-surface-2/60"
        : "bg-surface";

  const cell =
    "px-1 py-1.5 border-b border-r border-app text-center font-mono text-[11px] sm:text-xs tabular-nums text-app";
  const demand =
    "px-1 py-1.5 border-b border-r border-app text-center font-mono text-[11px] sm:text-xs font-bold tabular-nums text-accent bg-emerald-100/40 dark:bg-emerald-500/10";

  return (
    <tr
      data-slot={row.hourSlot}
      className={`${base} group hover:!bg-[var(--sticky-hover)] transition-colors`}
    >
      <td
        className={`time-col-sticky px-1 py-1.5 border-b border-r border-app text-center group-hover:!bg-[var(--sticky-hover)] ${
          isCurrentSlot
            ? "!bg-emerald-100 dark:!bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold"
            : prev
              ? "bg-[var(--sticky-purple)] text-violet-700 dark:text-violet-200"
              : isAlt
                ? "bg-[var(--sticky-odd)]"
                : "bg-[var(--sticky-even)]"
        }`}
        style={{ position: "sticky", left: 0, zIndex: 20 }}
      >
        <span className="block text-xs sm:text-[13px] font-bold tabular-nums font-mono">
          {row.hourSlot}
        </span>
        {isCurrentSlot && (
          <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            now
          </span>
        )}
        {prev && !isCurrentSlot && (
          <span className="block text-[8px] font-extrabold uppercase text-violet-600 dark:text-violet-400 tracking-wider">
            prev
          </span>
        )}
        {row.isSpecial && !isCurrentSlot && (
          <span className="text-[9px] text-amber-500 font-bold leading-none block">★</span>
        )}
      </td>
      <td className={cell}>{fmt(b.consumption)}</td>
      <td className={cell}>{fmt(b.loadshed)}</td>
      <td className={demand}>{fmt(b.demand)}</td>
      <td className={cell}>{fmt(b.allotment)}</td>
      <td className={cell}>{fmt(h.consumption)}</td>
      <td className={cell}>{fmt(h.loadshed)}</td>
      <td className={demand}>{fmt(h.demand)}</td>
      <td className={cell}>{fmt(h.allotment)}</td>
      <td className={`${cell} font-semibold`}>{fmt(t.consumption)}</td>
      <td className={demand}>{fmt(t.demand)}</td>
      <td className={cell}>{fmt(t.allotment)}</td>
      <td className={cell}>{fmt(t.loadshed)}</td>
    </tr>
  );
});

export default function KushtiaDistrictLoadView() {
  const [day, setDay] = useState(dayKeyNow);
  const [mobileView, setMobileView] = useState("table");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const tableContainerRef = useRef(null);
  const cardsContainerRef = useRef(null);

  const today = dayKeyNow();
  const currentSlot = currentSlotNow();
  const isToday = day === today;

  const load = useCallback(
    async (force = false) => {
      if (!force && dayCache.has(day)) {
        setData(dayCache.get(day));
        return;
      }
      setLoading(true);
      try {
        const res = await fetchDistrictDay({ day });
        const payload = res.data;
        dayCache.set(day, payload);
        setData(payload);
      } catch (err) {
        toast.error(err.message || "Failed to load");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [day]
  );

  useEffect(() => {
    load();
  }, [load]);

  const slots = useMemo(() => data?.slots || [], [data?.slots]);
  const boundary = data?.boundary || "22:00";

  // Smooth scroll logic: scroll to current slot
  const scrollToNow = useCallback(() => {
    const container = mobileView === "cards" ? cardsContainerRef.current : tableContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-slot="${currentSlot}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      toast("Current hour slot is not within this range", { icon: "ℹ️" });
    }
  }, [currentSlot, mobileView]);

  // Smooth scroll logic: scroll to top
  const scrollToTop = useCallback(() => {
    const container = mobileView === "cards" ? cardsContainerRef.current : tableContainerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [mobileView]);

  // Auto-scroll to active slot on initial load if viewing today
  useEffect(() => {
    if (!loading && data && isToday) {
      const timer = setTimeout(() => {
        const container = mobileView === "cards" ? cardsContainerRef.current : tableContainerRef.current;
        if (!container) return;
        const target = container.querySelector(`[data-slot="${currentSlot}"]`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loading, data, isToday, currentSlot, mobileView]);

  const summary = useMemo(() => {
    let peakDemand = 0;
    let peakDemandSlot = "";
    let peakConsumption = 0;
    let peakConsumptionSlot = "";
    let maxLoadshed = 0;
    let maxLoadshedSlot = "";
    for (const row of slots) {
      const d = Number(row.total?.demand) || 0;
      const c = Number(row.total?.consumption) || 0;
      const ls = Number(row.total?.loadshed) || 0;
      if (d >= peakDemand) {
        peakDemand = d;
        peakDemandSlot = row.hourSlot;
      }
      if (c >= peakConsumption) {
        peakConsumption = c;
        peakConsumptionSlot = row.hourSlot;
      }
      if (ls >= maxLoadshed) {
        maxLoadshed = ls;
        maxLoadshedSlot = row.hourSlot;
      }
    }
    return {
      peakDemand: peakDemand || null,
      peakDemandSlot,
      peakConsumption: peakConsumption || null,
      peakConsumptionSlot,
      maxLoadshed,
      maxLoadshedSlot,
    };
  }, [slots]);

  return (
    <div className="h-full w-full flex flex-col min-h-0 rounded-2xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 overflow-hidden shadow-sm">
      {/* ── Fixed Header Section ── */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 pb-2.5 border-b border-emerald-200/80 dark:border-teal-500/20 bg-emerald-50/60 dark:bg-teal-950/35 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
              Kushtia district
            </p>
            <h2 className="text-[15px] sm:text-base font-semibold text-app tracking-tight">
              Bottail + Bheramara load
            </h2>
            <p className="text-[10px] text-muted font-mono mt-0.5 truncate max-w-[18rem] sm:max-w-none">
              {data?.rangeLabel || `Boundary ${boundary}`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Scroll navigation helpers */}
            {isToday && (
              <button
                type="button"
                onClick={scrollToNow}
                className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-accent text-xs font-semibold inline-flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                title={`Jump to current hour slot (${currentSlot})`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Now</span>
                <span className="font-mono text-[11px] hidden sm:inline">{currentSlot}</span>
              </button>
            )}

            <button
              type="button"
              onClick={scrollToTop}
              className="h-8 sm:h-9 px-2 rounded-xl border border-app bg-surface-2 hover:bg-surface-3 text-secondary text-xs font-semibold inline-flex items-center gap-0.5 active:scale-95 transition-all shadow-sm"
              title="Scroll to top of sheet"
              aria-label="Scroll to top"
            >
              <span className="text-xs">↑</span>
              <span className="text-[10px] font-semibold hidden md:inline">Top</span>
            </button>

            {/* Date controls */}
            <button
              type="button"
              onClick={() => setDay((d) => shiftDay(d, -1))}
              className="h-8 sm:h-9 w-8 sm:w-9 inline-flex items-center justify-center rounded-xl border border-app bg-surface-2 text-app hover:bg-surface-3 active:scale-95 transition-colors"
              aria-label="Previous day"
            >
              ‹
            </button>
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => {
                if (e.target.value) setDay(clampDay(e.target.value));
              }}
              className="h-8 sm:h-9 px-2 rounded-xl border border-app bg-surface-2 text-xs sm:text-sm font-mono font-semibold text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() =>
                setDay((d) => {
                  const n = shiftDay(d, 1);
                  return n > today ? today : n;
                })
              }
              disabled={day >= today}
              className="h-8 sm:h-9 w-8 sm:w-9 inline-flex items-center justify-center rounded-xl border border-app bg-surface-2 text-app hover:bg-surface-3 active:scale-95 disabled:opacity-40 transition-colors"
              aria-label="Next day"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-surface-3 text-app text-[11px] font-bold uppercase tracking-wide hover:bg-surface-2 disabled:opacity-50 border border-app transition-colors"
              title="Reload data"
            >
              {loading ? "…" : "↻"}
            </button>

            {/* Mobile View Toggle */}
            <div className="md:hidden inline-flex items-center rounded-xl bg-surface-2 p-0.5 border border-app">
              <button
                type="button"
                onClick={() => setMobileView("table")}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${ mobileView === "table" ? "bg-surface-3 text-app shadow-sm" : "text-muted hover:text-secondary" }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setMobileView("cards")}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${ mobileView === "cards" ? "bg-surface-3 text-app shadow-sm" : "text-muted hover:text-secondary" }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* Summary KPIs: Pinned at top so operators always see peaks while scrolling */}
        <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              label: "Peak demand",
              value: summary.peakDemand,
              slot: summary.peakDemandSlot,
              card: "from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200 dark:from-emerald-950/55 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-emerald-500/25",
              title: "text-emerald-700 dark:text-emerald-300",
              accent: "text-emerald-700 dark:text-emerald-200",
            },
            {
              label: "Peak consumption",
              value: summary.peakConsumption,
              slot: summary.peakConsumptionSlot,
              card: "from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25",
              title: "text-emerald-700 dark:text-teal-300",
              accent: "text-emerald-700 dark:text-teal-200",
            },
            {
              label: "Max LS",
              value: summary.maxLoadshed,
              slot: summary.maxLoadshedSlot,
              card: "from-rose-50/90 via-white to-rose-50/40 border-rose-200 dark:from-rose-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-rose-500/25",
              title: "text-rose-700 dark:text-rose-300",
              accent: "text-rose-700 dark:text-rose-300",
            },
            {
              label: "Stations",
              value: null,
              text: "Bottail · Bheramara",
              slot: `${boundary} window`,
              card: "from-blue-50/90 via-white to-blue-50/40 border-blue-200 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25",
              title: "text-blue-700 dark:text-sky-300",
              accent: "text-blue-800 dark:text-sky-200",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border bg-gradient-to-br ${s.card} px-2.5 py-2 shadow-sm`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wider ${s.title}`}>
                {s.label}
              </p>
              <p
                className={`mt-0.5 font-mono text-xs sm:text-sm md:text-base font-bold tabular-nums ${s.accent}`}
              >
                {s.text
                  ? s.text
                  : s.value != null
                    ? `${fmt(s.value)} MW`
                    : "—"}
              </p>
              <p className="text-[10px] text-muted font-mono mt-0.5">
                {s.slot || "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Scroll Area ── */}
      {loading && !data ? (
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <SkeletonTable rows={12} columns={7} dark />
        </div>
      ) : (
        <>
          {/* Mobile: cards scrollable view */}
          {mobileView === "cards" && (
            <div
              ref={cardsContainerRef}
              className="md:hidden flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 space-y-2.5 pb-4"
            >
              {slots.map((row) => (
                <MobileSlotCard
                  key={`${row.dayKey}-${row.hourSlot}`}
                  row={row}
                  isCurrentSlot={isToday && row.hourSlot === currentSlot}
                />
              ))}
              {!loading && slots.length === 0 && (
                <p className="text-center text-muted text-sm py-12">
                  No data for this operational day
                </p>
              )}
            </div>
          )}

          {/* Unified Table scroll container: Single overflow-auto element for both X & Y */}
          <div
            ref={tableContainerRef}
            className={`flex-1 min-h-0 overflow-auto relative sheet-scroll-x overscroll-contain ${
              mobileView === "cards" ? "hidden md:block" : "block"
            }`}
          >
            <table
              className="sheet-table w-full text-left"
              style={{
                tableLayout: "fixed",
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: "62rem",
                width: "100%",
              }}
            >
              {/* Stable column width definition */}
              <colgroup>
                <col style={{ width: "4.75rem" }} />
                {/* Bottail: 4 cols */}
                <col style={{ width: "7.7%" }} />
                <col style={{ width: "7.7%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "7.7%" }} />
                {/* Bheramara: 4 cols */}
                <col style={{ width: "7.7%" }} />
                <col style={{ width: "7.7%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "7.7%" }} />
                {/* Total: 4 cols */}
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "9.5%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "8.5%" }} />
              </colgroup>

              {/* Two-tier Sticky Thead: Row 1 at top: 0, Row 2 at top: 32px */}
              <thead className="sticky top-0 z-40">
                {/* Row 1: Groups */}
                <tr className="h-8 text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold">
                  <th
                    rowSpan={2}
                    className="time-header-sticky px-2 py-1 border-b border-r border-app text-center align-middle"
                    style={{ position: "sticky", top: 0, left: 0, zIndex: 50, height: "64px" }}
                  >
                    Time
                  </th>
                  <th
                    colSpan={4}
                    className="h-8 px-1 py-1.5 border-b border-r border-teal-500/40 bg-teal-700 text-white text-center font-bold tracking-wider"
                    style={{ position: "sticky", top: 0, zIndex: 35, height: "32px" }}
                  >
                    Bottail
                  </th>
                  <th
                    colSpan={4}
                    className="h-8 px-1 py-1.5 border-b border-r border-amber-500/40 bg-amber-600 text-white text-center font-bold tracking-wider"
                    style={{ position: "sticky", top: 0, zIndex: 35, height: "32px" }}
                  >
                    Bheramara
                  </th>
                  <th
                    colSpan={4}
                    className="h-8 px-1 py-1.5 border-b border-r border-app bg-surface-3 text-app text-center font-bold tracking-wider"
                    style={{ position: "sticky", top: 0, zIndex: 35, height: "32px" }}
                  >
                    Total
                  </th>
                </tr>

                {/* Row 2: Sub-columns — all pinned uniformly at top: 32px with opaque backgrounds */}
                <tr className="h-8 text-[9px] uppercase tracking-wide font-semibold">
                  {/* Bottail subheaders */}
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-teal-500/30 bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-300 text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Consumption
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-teal-500/30 bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-300 text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    LS
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-accent bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-accent font-bold text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Demand
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-teal-500/30 bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-300 text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Allotment
                  </th>

                  {/* Bheramara subheaders */}
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-amber-500/30 bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Consumption
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-amber-500/30 bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    LS
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-accent bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-accent font-bold text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Demand
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-amber-500/30 bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Allotment
                  </th>

                  {/* Total subheaders */}
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-app bg-surface-2 text-secondary text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Consumption
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-accent bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-accent font-bold text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Demand
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-app bg-surface-2 text-secondary text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    Allotment
                  </th>
                  <th
                    className="h-8 px-1 py-1.5 border-b border-r border-app bg-surface-2 text-secondary text-center whitespace-nowrap"
                    style={{ position: "sticky", top: "32px", zIndex: 34, height: "32px" }}
                  >
                    LS
                  </th>
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody>
                {slots.map((row, i) => (
                  <DesktopRow
                    key={`${row.dayKey}-${row.hourSlot}`}
                    row={row}
                    isAlt={i % 2 === 1}
                    isCurrentSlot={isToday && row.hourSlot === currentSlot}
                  />
                ))}
                {!loading && slots.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-14 text-center text-muted text-sm"
                    >
                      No data for this operational day
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Fixed Footer Note ── */}
      <p className="shrink-0 px-3 py-2 text-[10px] text-muted border-t border-app bg-elevated/70 leading-relaxed">
        <strong className="text-secondary">Demand</strong> = Consumption + LS · Allotment
        defaults to demand · Window ends on selected date at{" "}
        <strong className="text-secondary">{boundary}</strong>
      </p>
    </div>
  );
}