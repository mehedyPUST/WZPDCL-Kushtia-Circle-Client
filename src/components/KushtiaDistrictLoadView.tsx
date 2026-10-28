"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
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
    teal: {
      bar: "bg-teal-500",
      head: "text-teal-300",
      demand: "text-teal-200 bg-teal-950/60",
    },
    amber: {
      bar: "bg-amber-500",
      head: "text-amber-300",
      demand: "text-amber-200 bg-amber-950/60",
    },
    slate: {
      bar: "bg-slate-600",
      head: "text-slate-300",
      demand: "text-emerald-200 bg-emerald-950/60",
    },
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className="rounded-xl border border-app bg-surface-2/60 overflow-hidden">
      <div className={`h-0.5 ${t.bar}`} />
      <div className="px-2.5 py-1.5 border-b border-app">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${t.head}`}>
          {title}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-px bg-white/5">
        {[
          { label: "Consumption", value: cons },
          { label: "LS", value: ls },
          { label: "Demand", value: demand, strong: true },
          { label: "Allotment", value: allot },
        ].map((c) => (
          <div
            key={c.label}
            className={`px-1 py-1.5 text-center ${c.strong ? t.demand : "bg-surface-2/60"
              }`}
          >
            <p className="text-[8px] font-semibold uppercase text-muted tracking-wide">
              {c.label}
            </p>
            <p
              className={`font-mono text-[11px] font-semibold tabular-nums ${c.strong ? "font-bold" : "text-secondary"
                }`}
            >
              {fmt(c.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MobileSlotCard = memo(function MobileSlotCard({ row }) {
  const b = row.bottail || {};
  const h = row.bheramara || {};
  const t = row.total || {};
  return (
    <article
      className={`rounded-2xl border shadow-sm overflow-hidden ${row.isPreviousDay
          ? "border-violet-500/30 bg-violet-950/40"
          : "border-app bg-surface-2/60"
        }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-app">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-app tabular-nums">
            {row.hourSlot}
          </span>
          {row.isPreviousDay && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              prev day
            </span>
          )}
          {row.isSpecial && (
            <span className="text-[10px] text-amber-400 font-bold">★</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase text-muted">
            Total demand
          </p>
          <p className="font-mono text-sm font-bold text-emerald-300 tabular-nums">
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

const DesktopRow = memo(function DesktopRow({ row, isAlt }) {
  const b = row.bottail || {};
  const h = row.bheramara || {};
  const t = row.total || {};
  const prev = row.isPreviousDay;
  const base = prev
    ? isAlt
      ? "bg-violet-950/40"
      : "bg-violet-950/25"
    : isAlt
      ? "bg-surface-2/60"
      : "bg-surface";
  const cell =
    "px-1 py-1.5 border-b border-r border-app text-center font-mono text-[11px] sm:text-xs tabular-nums text-app";
  const demand =
    "px-1 py-1.5 border-b border-r border-app text-center font-mono text-[11px] sm:text-xs font-bold tabular-nums text-emerald-700 bg-emerald-500/10";

  return (
    <tr className={`${base} group hover:!bg-[var(--sticky-hover)] transition-colors`}>
      <td
        className={`time-col-sticky px-1 py-1.5 border-b border-r border-app text-center group-hover:!bg-[var(--sticky-hover)] ${prev
            ? "bg-[var(--sticky-purple)] text-violet-700 dark:text-violet-200"
            : isAlt
              ? "bg-[var(--sticky-odd)]"
              : "bg-[var(--sticky-even)]"
          }`}
      >
        <span className="block text-xs sm:text-[13px] font-bold tabular-nums font-mono">
          {row.hourSlot}
        </span>
        {prev && (
          <span className="block text-[8px] font-extrabold uppercase text-violet-600 tracking-wider">
            prev
          </span>
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
  const today = dayKeyNow();

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

  const slots = data?.slots || [];
  const boundary = data?.boundary || "22:00";

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
    <div className="h-full w-full flex flex-col min-h-0 bg-surface-2/60 rounded-2xl border border-app overflow-hidden shadow-xl shadow-black/20">
      {/* Header */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 pb-2 border-b border-app bg-elevated/60">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
              Kushtia district
            </p>
            <h2 className="text-[15px] sm:text-base font-semibold text-app tracking-tight">
              Bottail + Bheramara load
            </h2>
            <p className="text-[10px] text-muted font-mono mt-0.5 truncate max-w-[18rem] sm:max-w-none">
              {data?.rangeLabel || `Boundary ${boundary}`}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDay((d) => shiftDay(d, -1))}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-app bg-surface-2 text-app hover:bg-surface-3 active:scale-95"
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
              className="h-9 px-2 rounded-xl border border-app bg-surface-2 text-xs sm:text-sm font-mono font-semibold text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
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
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-app bg-surface-2 text-app hover:bg-surface-3 active:scale-95 disabled:opacity-40"
              aria-label="Next day"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className="h-9 px-3 rounded-xl bg-surface-3 text-app text-[11px] font-bold uppercase tracking-wide hover:bg-surface-2 disabled:opacity-50 border border-app"
            >
              {loading ? "…" : "↻"}
            </button>
            <div className="md:hidden inline-flex items-center rounded-xl bg-surface-2 p-0.5 border border-app">
              <button
                type="button"
                onClick={() => setMobileView("table")}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  mobileView === "table"
                    ? "bg-surface-3 text-app dark:bg-slate-700 dark:text-white shadow-sm"
                    : "text-muted hover:text-secondary"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setMobileView("cards")}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  mobileView === "cards"
                    ? "bg-surface-3 text-app dark:bg-slate-700 dark:text-white shadow-sm"
                    : "text-muted hover:text-secondary"
                }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              label: "Peak demand",
              value: summary.peakDemand,
              slot: summary.peakDemandSlot,
              accent: "text-emerald-300",
            },
            {
              label: "Peak consumption",
              value: summary.peakConsumption,
              slot: summary.peakConsumptionSlot,
              accent: "text-teal-300",
            },
            {
              label: "Max LS",
              value: summary.maxLoadshed,
              slot: summary.maxLoadshedSlot,
              accent: "text-rose-300",
            },
            {
              label: "Stations",
              value: null,
              text: "Bottail · Bheramara",
              slot: `${boundary} window`,
              accent: "text-secondary",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-app bg-surface-2 px-2.5 py-2 shadow-sm"
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted">
                {s.label}
              </p>
              <p
                className={`mt-0.5 font-mono text-sm sm:text-base font-bold tabular-nums ${s.accent}`}
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

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && !data ? (
          <div className="p-4">
            <SkeletonTable rows={10} columns={7} dark />
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            {mobileView === "cards" && (
              <div className="md:hidden p-2.5 space-y-2.5 pb-4">
                {slots.map((row) => (
                  <MobileSlotCard
                    key={`${row.dayKey}-${row.hourSlot}`}
                    row={row}
                  />
                ))}
                {!loading && slots.length === 0 && (
                  <p className="text-center text-muted text-sm py-12">
                    No data for this operational day
                  </p>
                )}
              </div>
            )}

            {/* Table */}
            <div className={`overflow-x-auto overflow-y-auto flex-1 min-h-0 relative sheet-scroll-x ${mobileView === "cards" ? "hidden md:block" : "block"}`}>
              <table
                className="sheet-table w-full text-left border border-app"
                style={{
                  tableLayout: "fixed",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  minWidth: "56rem",
                  width: "100%",
                }}
              >
                <thead className="sticky-head sticky top-0 z-40">
                  <tr className="text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold">
                    <th
                      rowSpan={2}
                      className="time-header-sticky px-2 py-2.5 border-b border-r border-app text-center align-middle"
                    >
                      Time
                    </th>
                    <th
                      colSpan={4}
                      className="px-1 py-2 border-b border-r border-teal-500/40 bg-teal-700 text-white text-center"
                      style={{ position: "sticky", top: 0, zIndex: 30 }}
                    >
                      Bottail
                    </th>
                    <th
                      colSpan={4}
                      className="px-1 py-2 border-b border-r border-amber-500/40 bg-amber-600 text-white text-center"
                      style={{ position: "sticky", top: 0, zIndex: 30 }}
                    >
                      Bheramara
                    </th>
                    <th
                      colSpan={4}
                      className="px-1 py-2 border-b border-r border-app-strong bg-surface-2 text-app text-center"
                      style={{ position: "sticky", top: 0, zIndex: 30 }}
                    >
                      Total
                    </th>
                  </tr>
                  <tr className="text-[9px] uppercase tracking-wide font-semibold">
                    <th
                      className="px-1 py-2 border-b border-r border-teal-500/30 bg-teal-950/70 text-teal-300 text-center"
                      style={{ position: "sticky", top: "33px", zIndex: 30 }}
                    >
                      Consumption
                    </th>
                    <th className="px-1 py-2 border-b border-r border-teal-500/30 bg-teal-950/70 text-teal-300 text-center">
                      LS
                    </th>
                    <th className="px-1 py-2 border-b border-r border-emerald-500/30 bg-emerald-950/80 text-emerald-300 text-center">
                      Demand
                    </th>
                    <th className="px-1 py-2 border-b border-r border-teal-500/30 bg-teal-950/70 text-teal-300 text-center">
                      Allotment
                    </th>
                    <th className="px-1 py-2 border-b border-r border-amber-500/30 bg-amber-950/70 text-amber-300 text-center">
                      Consumption
                    </th>
                    <th className="px-1 py-2 border-b border-r border-amber-500/30 bg-amber-950/70 text-amber-300 text-center">
                      LS
                    </th>
                    <th className="px-1 py-2 border-b border-r border-emerald-500/30 bg-emerald-950/80 text-emerald-300 text-center">
                      Demand
                    </th>
                    <th className="px-1 py-2 border-b border-r border-amber-500/30 bg-amber-950/70 text-amber-300 text-center">
                      Allotment
                    </th>
                    <th className="px-1 py-2 border-b border-r border-app-strong bg-surface-2 text-secondary text-center">
                      Consumption
                    </th>
                    <th className="px-1 py-2 border-b border-r border-emerald-500/30 bg-emerald-950/80 text-emerald-300 text-center">
                      Demand
                    </th>
                    <th className="px-1 py-2 border-b border-r border-app-strong bg-surface-2 text-secondary text-center">
                      Allotment
                    </th>
                    <th className="px-1 py-2 border-b border-app-strong bg-surface-2 text-secondary text-center">
                      LS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((row, i) => (
                    <DesktopRow
                      key={`${row.dayKey}-${row.hourSlot}`}
                      row={row}
                      isAlt={i % 2 === 1}
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
      </div>

      <p className="shrink-0 px-3 py-2 text-[10px] text-muted border-t border-app bg-elevated/60 leading-relaxed">
        <strong className="text-secondary">Demand</strong> = Consumption + LS · Allotment
        defaults to demand · Window ends on selected date at{" "}
        <strong className="text-secondary">{boundary}</strong>
      </p>
    </div>
  );
}