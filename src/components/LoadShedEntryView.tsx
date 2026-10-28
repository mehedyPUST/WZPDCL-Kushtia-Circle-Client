"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchCalculations, saveCalculation, updateCalculation } from "@/lib/api";
import { FEEDERS, LS_PROTECTED_IDS, BOTTAIL_11KV_IDS } from "@/lib/constants";
import {
  LOGSHEET_SLOTS,
  recordSlotLabel,
  formatDayLabel,
} from "@/lib/logsheetSlots";
import { useAuth } from "@/hooks/useAuth";
import SkeletonTable from "./SkeletonTable";

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
}

function shiftYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function round1(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

function formatMW(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return round1(Number(v)).toFixed(1);
}

function slotDateIso(dayKey, slot) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d, slot.hour, slot.minute, 0, 0);
  return dt.toISOString();
}

function emptyLsMap() {
  const m = {};
  FEEDERS.forEach((f) => {
    m[f.id] = "";
  });
  return m;
}

function slotStateFromRecord(rec) {
  const ls = emptyLsMap();
  if (rec?.feeders) {
    for (const f of rec.feeders) {
      if (f?.id != null) {
        const v = Number(f.lsMW);
        ls[f.id] = Number.isFinite(v) && v > 0 ? String(round1(v)) : "";
      }
    }
  }
  const all =
    rec?.allotment != null && Number.isFinite(Number(rec.allotment))
      ? String(round1(Number(rec.allotment)))
      : "";
  return {
    recordId: rec?._id || null,
    totalMW: Number(rec?.totalMW) || 0,
    busVoltages: rec?.busVoltages || { bus1: 0, bus2: 0 },
    feedersRaw: rec?.feeders || [],
    hasLoad: !!(
      rec &&
      (rec.totalMW > 0 || (rec.feeders || []).some((f) => (f.mw || 0) > 0))
    ),
    allotment: all,
    ls,
    dirty: false,
  };
}

function emptySlotState() {
  return {
    recordId: null,
    totalMW: 0,
    busVoltages: { bus1: 0, bus2: 0 },
    feedersRaw: [],
    hasLoad: false,
    allotment: "",
    ls: emptyLsMap(),
    dirty: false,
  };
}

const COL_COUNT = 16;
const COL_WIDTH = 68;
const STICKY_TIME_W = "4.75rem";

const FEEDER_COL = {
  1: { head: "bg-purple-100 text-purple-900 dark:bg-purple-950/85 dark:text-purple-200", input: "border-app focus:border-purple-400 focus:ring-purple-500/40" },
  2: { head: "bg-sky-100 text-sky-900 dark:bg-sky-950/85 dark:text-sky-200", input: "border-app focus:border-sky-400 focus:ring-sky-500/40" },
  3: { head: "bg-purple-100 text-purple-900 dark:bg-purple-950/85 dark:text-purple-200", input: "border-app focus:border-purple-400 focus:ring-purple-500/40" },
  4: { head: "bg-sky-100 text-sky-900 dark:bg-sky-950/85 dark:text-sky-200", input: "border-app focus:border-sky-400 focus:ring-sky-500/40" },
  5: { head: "bg-sky-100 text-sky-900 dark:bg-sky-950/85 dark:text-sky-200", input: "border-app focus:border-sky-400 focus:ring-sky-500/40" },
  6: { head: "bg-purple-100 text-purple-900 dark:bg-purple-950/85 dark:text-purple-200", input: "border-app focus:border-purple-400 focus:ring-purple-500/40" },
  7: { head: "bg-purple-100 text-purple-900 dark:bg-purple-950/85 dark:text-purple-200", input: "border-app focus:border-purple-400 focus:ring-purple-500/40" },
  8: { head: "bg-sky-100 text-sky-900 dark:bg-sky-950/85 dark:text-sky-200", input: "border-app focus:border-sky-400 focus:ring-sky-500/40" },
  9: { head: "bg-purple-100 text-purple-900 dark:bg-purple-950/85 dark:text-purple-200", input: "border-app focus:border-purple-400 focus:ring-purple-500/40" },
};

export default function LoadShedEntryView() {
  const { isAuthenticated } = useAuth();
  const [dayKey, setDayKey] = useState(todayKey);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState(null);
  const [editingRows, setEditingRows] = useState({});
  const [slots, setSlots] = useState(() => {
    const init = {};
    for (const s of LOGSHEET_SLOTS) init[s.label] = emptySlotState();
    return init;
  });

  const loadDay = useCallback(async (key) => {
    setLoading(true);
    try {
      const res = await fetchCalculations({ date: key, limit: "all" });
      const docs = res?.data || res?.calculations || [];
      const bySlot = {};
      for (const s of LOGSHEET_SLOTS) bySlot[s.label] = emptySlotState();

      for (const doc of docs) {
        const label = recordSlotLabel(doc);
        if (!label || !bySlot[label]) continue;
        const existing = bySlot[label];
        if (existing.recordId && !doc.isHourly && existing.hasLoad) continue;
        bySlot[label] = slotStateFromRecord(doc);
      }
      setSlots(bySlot);
      setEditingRows({});
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to load day data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(dayKey);
  }, [dayKey, loadDay]);

  const setSlotField = (label, patch) => {
    setSlots((prev) => ({
      ...prev,
      [label]: { ...prev[label], ...patch, dirty: true },
    }));
  };

  const setLs = (label, feederId, value) => {
    setSlots((prev) => {
      const cur = prev[label] || emptySlotState();
      return {
        ...prev,
        [label]: {
          ...cur,
          ls: { ...cur.ls, [feederId]: value },
          dirty: true,
        },
      };
    });
  };

  const totalsFor = (st) => {
    let totalLs = 0;
    const feederMw = {};
    const feederLs = {};
    for (const f of FEEDERS) {
      const fromRaw = st.feedersRaw?.find((x) => x.id === f.id);
      feederMw[f.id] = Number(fromRaw?.mw) || 0;
      const lsV = parseFloat(st.ls[f.id]) || 0;
      feederLs[f.id] = lsV;
      totalLs += lsV;
    }
    const consumption =
      st.totalMW || Object.values(feederMw).reduce((a, b) => a + b, 0);
    const demand = round1(consumption + totalLs);
    const allot = parseFloat(st.allotment);
    const hasAllot = Number.isFinite(allot) && allot >= 0;
    const shortage = hasAllot ? Math.max(0, demand - allot) : 0;
    const remaining = hasAllot ? Math.max(0, shortage - totalLs) : 0;
    const h3t3Ls = (feederLs[8] || 0) + (feederLs[9] || 0);
    return {
      consumption: round1(consumption),
      demand: round1(demand),
      totalLs: round1(totalLs),
      allotment: hasAllot ? round1(allot) : null,
      shortage: round1(shortage),
      remaining: round1(remaining),
      feederMw,
      h3t3Ls: round1(h3t3Ls),
    };
  };

  const daySummary = useMemo(() => {
    let lsSum = 0;
    let shortageSlots = 0;
    let slotsWithLs = 0;
    let dirtyCount = 0;
    for (const s of LOGSHEET_SLOTS) {
      const st = slots[s.label] || emptySlotState();
      const t = totalsFor(st);
      lsSum += t.totalLs;
      if (t.shortage > 0.05) shortageSlots++;
      if (t.totalLs > 0.05) slotsWithLs++;
      if (st.dirty) dirtyCount++;
    }
    return {
      lsSum: round1(lsSum),
      shortageSlots,
      slotsWithLs,
      dirtyCount,
    };
  }, [slots]);

  const enableRowEdit = (label) => {
    setEditingRows((prev) => ({ ...prev, [label]: true }));
  };

  const disableRowEdit = (label) => {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  };

  const clearSlotLs = (label) => {
    setSlotField(label, { ls: emptyLsMap() });
    enableRowEdit(label);
  };

  const buildPayload = (label, st) => {
    const slotMeta = LOGSHEET_SLOTS.find((s) => s.label === label);
    const feeders = FEEDERS.map((f) => {
      const raw = st.feedersRaw?.find((x) => x.id === f.id);
      return {
        id: f.id,
        name: f.name,
        bus: f.bus,
        amps: Number(raw?.amps) || 0,
        mw: Number(raw?.mw) || 0,
        lsMW: Math.max(0, parseFloat(st.ls[f.id]) || 0),
        ringActive: raw?.ringActive === true,
      };
    });
    const totalMW = feeders.reduce((s, f) => s + f.mw, 0);
    const bottail11kV = feeders
      .filter((f) => BOTTAIL_11KV_IDS.includes(f.id))
      .reduce((s, f) => s + f.mw, 0);
    const allotRaw = parseFloat(st.allotment);
    const allotment =
      st.allotment === "" || !Number.isFinite(allotRaw)
        ? null
        : Math.max(0, allotRaw);

    return {
      busVoltages: {
        bus1: Number(st.busVoltages?.bus1) || 0,
        bus2: Number(st.busVoltages?.bus2) || 0,
      },
      feeders,
      bottail11kV,
      totalMW,
      allotment,
      hourSlot: label,
      isHourly: true,
      calculatedAt: slotDateIso(dayKey, slotMeta),
      note: st.hasLoad
        ? `LS entry · ${label}`
        : `LS-only entry · ${label} (no load reading)`,
      hasActiveRing: feeders.some((f) => f.ringActive),
    };
  };

  const saveSlot = async (label) => {
    if (!isAuthenticated) {
      toast.error("Please sign in to save load-shed data.");
      return;
    }
    const st = slots[label];
    if (!st) return;
    setSavingSlot(label);
    try {
      const payload = buildPayload(label, st);
      let res;
      if (st.recordId) {
        res = await updateCalculation(st.recordId, payload);
      } else {
        res = await saveCalculation(payload);
      }
      const saved = res?.data || res;
      setSlots((prev) => ({
        ...prev,
        [label]: {
          ...slotStateFromRecord(saved),
          dirty: false,
        },
      }));
      disableRowEdit(label);
      toast.success(`Saved LS for ${label}`);
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingSlot(null);
    }
  };

  const saveAllDirty = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to save.");
      return;
    }
    const dirtyLabels = LOGSHEET_SLOTS.map((s) => s.label).filter(
      (l) => slots[l]?.dirty
    );
    if (!dirtyLabels.length) {
      toast("No unsaved changes.");
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const label of dirtyLabels) {
      try {
        const st = slots[label];
        if (!st) continue;
        setSavingSlot(label);
        const payload = buildPayload(label, st);
        let res;
        if (st.recordId) {
          res = await updateCalculation(st.recordId, payload);
        } else {
          res = await saveCalculation(payload);
        }
        const saved = res?.data || res;
        setSlots((prev) => ({
          ...prev,
          [label]: { ...slotStateFromRecord(saved), dirty: false },
        }));
        disableRowEdit(label);
        ok++;
      } catch {
        fail++;
      } finally {
        setSavingSlot(null);
      }
    }
    if (fail === 0) toast.success(`Saved ${ok} slot(s)`);
    else toast.error(`Saved ${ok}, failed ${fail}`);
  };

  const protectedSet = useMemo(() => new Set(LS_PROTECTED_IDS), []);

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface-2/60 rounded-2xl border border-app overflow-hidden shadow-xl shadow-black/40">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2.5 sm:py-3 bg-elevated/75 border-b border-app">
        <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted">
          Day
        </label>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDayKey((d) => shiftYmd(d, -1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-app bg-surface-2 text-app hover:bg-surface-3 transition-colors"
            aria-label="Previous day"
          >
            ‹
          </button>
          <input
            type="date"
            value={dayKey}
            max={todayKey()}
            onChange={(e) => e.target.value && setDayKey(e.target.value)}
            className="text-xs sm:text-sm font-medium bg-surface-2 border border-app rounded-lg px-2 sm:px-2.5 py-1.5 text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 min-w-0"
          />
          <button
            type="button"
            onClick={() => {
              const n = shiftYmd(dayKey, 1);
              if (n <= todayKey()) setDayKey(n);
            }}
            disabled={dayKey >= todayKey()}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-app bg-surface-2 text-app hover:bg-surface-3 disabled:opacity-40 transition-colors"
            aria-label="Next day"
          >
            ›
          </button>
        </div>

        <span className="text-xs font-medium text-secondary hidden sm:inline">
          {formatDayLabel(dayKey)}
        </span>

        <span className="text-xs text-muted tabular-nums">
          Day LS{" "}
          <strong className="text-rose-600 dark:text-rose-300">{daySummary.lsSum.toFixed(1)}</strong>{" "}
          MW
          {" · "}
          Slots w/ LS{" "}
          <strong className="text-app">{daySummary.slotsWithLs}</strong>
          {daySummary.shortageSlots > 0 && (
            <>
              {" · "}
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                Shortage {daySummary.shortageSlots}
              </span>
            </>
          )}
          {daySummary.dirtyCount > 0 && (
            <>
              {" · "}
              <span className="text-sky-600 dark:text-sky-400 font-semibold">
                Unsaved {daySummary.dirtyCount}
              </span>
            </>
          )}
        </span>

        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => loadDay(dayKey)}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-2 border border-app text-app hover:bg-surface-3 disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={saveAllDirty}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-colors"
          >
            Save all
          </button>
        </div>
      </div>

      <p className="flex-shrink-0 px-3 sm:px-4 py-1.5 text-[11px] text-slate-400 leading-snug border-b border-app bg-elevated/50">
        <strong className="text-amber-300">Allot</strong> = grid allotment (empty = unlimited).{" "}
        <strong className="text-purple-300">Demand</strong> = Total + LS.{" "}
        <strong className="text-emerald-300">Total (Consumption)</strong> = running load. Enter <strong className="text-rose-300">LS MW</strong> per
        feeder after unlocking a row. BRB &amp; MRS stay free.
      </p>

      {/* Sheet — scroll container is here so sticky works */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative sheet-scroll-x">
        {loading ? (
          <div className="p-3">
            <SkeletonTable rows={10} columns={12} dark />
          </div>
        ) : (
          <table
            className="sheet-table text-left border border-app"
            style={{ borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead className="sticky top-0 z-40">
              <tr className="bg-elevated text-slate-200 text-[10px] uppercase tracking-wider">
                <th className="time-header-sticky px-1 py-2.5 font-bold font-mono text-center text-[11px] uppercase tracking-wider">
                  Time
                </th>
                <th
                  className="px-1.5 py-2.5 font-semibold text-center border-b border-r border-app bg-amber-950/85 text-amber-300"
                  title="Grid allotment MW — empty = unlimited"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: 0 }}
                >
                  Allotment
                </th>
                <th
                  className="px-1.5 py-2.5 font-semibold text-center border-b border-r border-app bg-purple-950/90 text-purple-300"
                  title="Demand MW = Total (Consumption) + LS"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: 0 }}
                >
                  Demand
                </th>
                <th
                  className="px-1 py-2 font-semibold text-center border-b border-r border-app bg-emerald-950/90 text-emerald-300 leading-tight"
                  title="Running load / actual consumption MW"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: 0 }}
                >
                  Total
                  <span className="block text-[8px] font-normal normal-case opacity-80 leading-tight">
                    (Consumption)
                  </span>
                </th>
                <th
                  className="px-1.5 py-2.5 font-semibold text-center border-b border-r border-app bg-rose-950/90 text-rose-300"
                  title="Sum of LS MW"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: 0 }}
                >
                  Σ LS
                </th>
                {FEEDERS.map((f) => {
                  const col = FEEDER_COL[f.id] || { head: "bg-surface-2 text-slate-200" };
                  const isProt = protectedSet.has(f.id);
                  return (
                    <th
                      key={f.id}
                      className={`px-1 py-2.5 font-semibold text-center whitespace-nowrap border-b border-r border-app ${isProt ? "bg-cyan-950/75 text-cyan-200" : col.head
                        }`}
                      title={
                        isProt
                          ? `${f.name} (protected — free during LS)`
                          : `LS MW · ${f.name}`
                      }
                      style={{ width: `${100 / COL_COUNT}%`, minWidth: 0 }}
                    >
                      {f.name}
                      {isProt && (
                        <span className="block text-[8px] font-normal normal-case tracking-normal text-emerald-400">
                          free
                        </span>
                      )}
                    </th>
                  );
                })}
                <th
                  className="px-1 py-2.5 font-semibold text-center whitespace-nowrap bg-teal-950/90 text-teal-300 border-b border-r border-app"
                  title="H-3 + T-3 LS sum"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: 0 }}
                >
                  H3+T3
                </th>
                <th
                  className="px-0.5 py-2.5 font-semibold text-center bg-amber-950/85 text-amber-200 border-b border-app col-action"
                  style={{ width: "5.5rem", minWidth: "5.5rem", maxWidth: "5.5rem" }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {LOGSHEET_SLOTS.map((slot, idx) => {
                const st = slots[slot.label] || emptySlotState();
                const t = totalsFor(st);
                const isEditing = !!editingRows[slot.label];
                const over =
                  t.allotment != null && t.demand > t.allotment + 0.05;
                const underCovered = over && t.remaining > 0.05;
                const alt = idx % 2 === 1;

                let rowBg = alt ? "bg-surface-2/75" : "bg-surface";
                let stickyBg = alt ? "var(--sticky-odd)" : "var(--sticky-even)";

                if (underCovered) {
                  rowBg = alt ? "bg-rose-950/45" : "bg-rose-950/35";
                  stickyBg = alt ? "var(--sticky-rose-alt)" : "var(--sticky-rose)";
                } else if (over) {
                  rowBg = alt ? "bg-amber-950/40" : "bg-amber-950/30";
                  stickyBg = alt ? "var(--sticky-special-alt)" : "var(--sticky-special)";
                } else if (st.dirty) {
                  rowBg = alt ? "bg-sky-950/40" : "bg-sky-950/30";
                  stickyBg = alt ? "var(--sticky-sky-alt)" : "var(--sticky-sky)";
                } else if (slot.isSpecial) {
                  rowBg = alt ? "bg-amber-950/35" : "bg-amber-950/25";
                  stickyBg = alt ? "var(--sticky-special-alt)" : "var(--sticky-special)";
                }

                return (
                  <tr
                    key={slot.label}
                    className={`group transition-colors duration-150 ${rowBg} hover:!bg-slate-800/80`}
                  >
                    <td
                      className={`time-col-sticky px-1 py-1.5 text-center align-middle font-mono font-bold text-xs sm:text-[13px] tabular-nums border-b border-r border-app group-hover:!bg-[var(--sticky-hover)] ${slot.isSpecial
                          ? "text-amber-300 font-extrabold"
                          : "text-slate-100"
                        }`}
                      style={{ backgroundColor: stickyBg }}
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>{slot.label}</span>
                        {st.hasLoad && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                            title="Load data present"
                          />
                        )}
                      </div>
                    </td>

                    {/* Allotment */}
                    <td className="px-0.5 py-1 border-b border-r border-app align-middle text-center bg-amber-950/15 group-hover:bg-amber-950/30">
                      {isEditing ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          placeholder="∞"
                          value={st.allotment}
                          onChange={(e) =>
                            setSlotField(slot.label, {
                              allotment: e.target.value,
                            })
                          }
                          className="w-full min-w-0 rounded border border-amber-500/35 bg-elevated px-0.5 py-0.5 text-center font-mono text-[11px] tabular-nums font-semibold text-amber-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          title="Grid allotment (MW). Empty = unlimited"
                        />
                      ) : (
                        <span className="block text-center font-mono text-[11px] tabular-nums font-medium text-amber-300/90 px-1">
                          {st.allotment !== "" ? formatMW(st.allotment) : "∞"}
                        </span>
                      )}
                    </td>

                    {/* Demand */}
                    <td className="px-1.5 py-1 text-center font-mono tabular-nums font-bold text-purple-300 border-b border-r border-app bg-purple-950/20 group-hover:bg-purple-950/35">
                      {st.hasLoad || t.totalLs > 0 ? formatMW(t.demand) : "—"}
                    </td>

                    {/* Total */}
                    <td className="px-1.5 py-1 text-center font-mono tabular-nums font-semibold text-emerald-400 border-b border-r border-app bg-emerald-950/20 group-hover:bg-emerald-950/35">
                      {st.hasLoad ? formatMW(t.consumption) : "—"}
                    </td>

                    {/* Σ LS */}
                    <td
                      className={`px-1.5 py-1 text-center font-mono tabular-nums font-bold border-b border-r border-app ${t.totalLs > 0.05
                          ? "bg-rose-950/35 text-rose-400"
                          : "text-slate-600"
                        } group-hover:bg-rose-950/45`}
                    >
                      {formatMW(t.totalLs)}
                    </td>

                    {/* Per-feeder LS */}
                    {FEEDERS.map((f) => {
                      const col = FEEDER_COL[f.id] || {};
                      const isProt = protectedSet.has(f.id);
                      return (
                        <td
                          key={f.id}
                          className={`px-0.5 py-1 border-b border-r border-app align-middle text-center ${isProt
                              ? "bg-elevated/60 text-slate-600"
                              : "text-slate-200"
                            } group-hover:bg-slate-800/60`}
                        >
                          {isEditing && !isProt ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              min="0"
                              placeholder="0"
                              value={st.ls[f.id] ?? ""}
                              onChange={(e) =>
                                setLs(slot.label, f.id, e.target.value)
                              }
                              className={`w-full min-w-0 rounded border px-0.5 py-0.5 text-center font-mono text-[11px] tabular-nums font-semibold focus:outline-none focus:ring-1 bg-elevated text-white placeholder:text-slate-600 ${col.input || "border-app focus:ring-emerald-500"
                                }`}
                            />
                          ) : (
                            <span
                              className={`block text-center font-mono text-[11px] tabular-nums px-0.5 ${isProt
                                  ? "text-slate-600 font-normal"
                                  : st.ls[f.id]
                                    ? "font-bold text-rose-300"
                                    : "text-slate-600 font-normal"
                                }`}
                            >
                              {isProt
                                ? "—"
                                : st.ls[f.id]
                                  ? formatMW(st.ls[f.id])
                                  : "—"}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* H3+T3 */}
                    <td className="px-1 py-1 text-center font-mono tabular-nums font-semibold text-teal-300 border-b border-r border-app bg-teal-950/20 group-hover:bg-teal-950/35">
                      {t.h3t3Ls > 0.05 ? formatMW(t.h3t3Ls) : "—"}
                    </td>

                    {/* Action */}
                    <td className="px-0.5 py-0.5 align-middle text-center border-b border-app group-hover:bg-slate-800/60">
                      <div className="flex flex-col gap-0.5 items-center justify-center">
                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => enableRowEdit(slot.label)}
                            className="w-full max-w-[48px] rounded px-1 py-0.5 text-[9px] font-bold bg-sky-600 text-white hover:bg-sky-500 border border-sky-500/40 transition-colors"
                          >
                            Edit
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => clearSlotLs(slot.label)}
                              className="w-full max-w-[48px] rounded px-1 py-0.5 text-[9px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-app"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => saveSlot(slot.label)}
                              disabled={savingSlot === slot.label}
                              className="w-full max-w-[48px] rounded px-1 py-0.5 text-[9px] font-bold bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500"
                            >
                              {savingSlot === slot.label ? "…" : "Save"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}