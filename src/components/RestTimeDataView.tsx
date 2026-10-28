"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FEEDERS, BOTTAIL_11KV_IDS, RING_LINES, RING_BY_FEEDER, feederAllowsRing } from "@/lib/constants";
import {
  REST_SLOT_LABELS,
  REQUIRED_SLOTS,
  OPTIONAL_REST_SLOTS,
  PREV_CONTEXT_SLOTS,
  generateRestTimeData,
  approximateFajrHour,
  BUS1_MAX_KV,
  BUS2_MAX_KV,
} from "@/lib/restTimeGenerate";
import { toDayKey, formatDayLabel } from "@/lib/logsheetSlots";
import {
  buildCalculationResult,
  computeFeederMW,
  getVoltageForFeeder,
} from "@/lib/calculations";
import {
  fetchCalculations,
  saveCalculation,
  updateCalculation,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";
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

function slotToDate(dayKey, label) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const [hh, mm] = label.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 6, mm || 0, 0, 0)).toISOString();
}

function emptyAmps() {
  const o = {};
  FEEDERS.forEach((f) => {
    o[f.id] = "";
  });
  return o;
}

function emptySlot() {
  return { amps: emptyAmps(), bus1: "", bus2: "", rings: {} };
}

function emptyRings() {
  const o = {};
  FEEDERS.forEach((f) => {
    o[f.id] = false;
  });
  return o;
}

function ringPartnerHint(feederId) {
  if (!feederAllowsRing(feederId)) return "No ring line";
  const info = RING_BY_FEEDER[feederId] || RING_BY_FEEDER[Number(feederId)];
  if (info?.partner) return info.partner;
  const hits = (RING_LINES || []).filter((r) =>
    (r.feederIds || []).includes(Number(feederId))
  );
  if (!hits.length) return "Ring line";
  return hits.map((h) => h.partner || h.label).join(" · ");
}

/** Fit all columns to the panel width — no horizontal scroll on this page */
const COL_COUNT = 15;
const COL_WIDTH = 68;

/** Cohesive substation bus-coded feeder columns */
const FEEDER_COL = {
  1: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  2: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  3: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  4: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  5: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  6: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  7: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  8: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
  9: { head: "bg-surface-2 text-secondary", cell: "bg-transparent", input: "border-app focus:border-emerald-400 focus:ring-emerald-500/40" },
};

function fmtMW(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return (Math.round((Number(v) + Number.EPSILON) * 10) / 10).toFixed(1);
}

/**
 * Rest-time sheet — same UI language as Manual Input.
 * Special logic: generate 01–07 from 00:00 & 08:00 (+ optional mid anchors).
 */
export default function RestTimeDataView() {
  const { isAuthenticated, login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [day, setDay] = useState(todayKey);
  const [grid, setGrid] = useState(() => {
    const g = {};
    [...PREV_CONTEXT_SLOTS, ...REST_SLOT_LABELS].forEach((l) => {
      g[l] = emptySlot();
    });
    return g;
  });
  const [sourceMap, setSourceMap] = useState({});
  const [busSource, setBusSource] = useState({});
  const [editingRows, setEditingRows] = useState({});
  const [showPrev, setShowPrev] = useState(true);
  const [sheetMode, setSheetMode] = useState("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSlot, setSavingSlot] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [meta, setMeta] = useState(null);
  const [existingIds, setExistingIds] = useState({});

  const month = Number(day.split("-")[1]) || 1;
  const fajrApprox = approximateFajrHour(month);

  const visibleSlots = useMemo(() => {
    if (showPrev) return [...PREV_CONTEXT_SLOTS, ...REST_SLOT_LABELS];
    return REST_SLOT_LABELS;
  }, [showPrev]);

  const prevLoadedCount = useMemo(() => {
    return PREV_CONTEXT_SLOTS.filter((s) =>
      FEEDERS.some((f) => {
        const v = parseFloat(grid[s]?.amps?.[f.id]);
        return Number.isFinite(v) && String(grid[s]?.amps?.[f.id]).trim() !== "";
      })
    ).length;
  }, [grid]);

  const loadDay = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const prevDay = shiftYmd(day, -1);

      const [resToday, resPrev] = await Promise.all([
        fetchCalculations({ limit: 100, date: day }),
        fetchCalculations({ limit: 100, date: prevDay }),
      ]);

      const todayList = Array.isArray(resToday?.data) ? resToday.data : [];
      const prevList = Array.isArray(resPrev?.data) ? resPrev.data : [];

      const next = {};
      [...PREV_CONTEXT_SLOTS, ...REST_SLOT_LABELS].forEach((l) => {
        next[l] = emptySlot();
      });
      const ids = {};
      const src = {};

      const applyRec = (rec, allowedSlots, expectedDay) => {
        const dk = toDayKey(rec.calculatedAt || rec.createdAt);
        if (expectedDay && dk && dk !== expectedDay) return;

        let slot =
          (rec.hourSlot && String(rec.hourSlot).trim()) ||
          null;
        if (slot) {
          const m = slot.match(/^(\d{1,2}):(\d{2})$/);
          if (m) slot = `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
        }
        if (!slot || !allowedSlots.has(slot) || !next[slot]) return;

        const amps = emptyAmps();
        (rec.feeders || []).forEach((f) => {
          if (f?.id != null)
            amps[f.id] = String(Math.round(Number(f.amps) || 0));
        });
        const rings = emptyRings();
        (rec.feeders || []).forEach((f) => {
          if (f?.id != null && f.ringActive === true) rings[f.id] = true;
        });
        next[slot] = {
          amps,
          bus1:
            rec.busVoltages?.bus1 != null ? String(rec.busVoltages.bus1) : "",
          bus2:
            rec.busVoltages?.bus2 != null ? String(rec.busVoltages.bus2) : "",
          rings,
        };
        if (rec._id && REST_SLOT_LABELS.includes(slot)) ids[slot] = rec._id;
        src[slot] = {};
        FEEDERS.forEach((f) => {
          src[slot][f.id] = "loaded";
        });
      };

      const restSet = new Set(REST_SLOT_LABELS);
      const prevSet = new Set(PREV_CONTEXT_SLOTS);

      for (const rec of todayList) {
        applyRec(rec, restSet, day);
      }
      for (const rec of prevList) {
        applyRec(rec, prevSet, prevDay);
      }

      for (const want of PREV_CONTEXT_SLOTS) {
        if (
          FEEDERS.some((f) => {
            const v = parseFloat(next[want]?.amps?.[f.id]);
            return Number.isFinite(v) && String(next[want]?.amps?.[f.id]).trim() !== "";
          })
        )
          continue;
        const wantH = Number(want.slice(0, 2));
        let best = null;
        let bestDiff = 99;
        for (const rec of prevList) {
          const dk = toDayKey(rec.calculatedAt || rec.createdAt);
          if (dk !== prevDay) continue;
          const iso = rec.calculatedAt || rec.createdAt;
          if (!iso) continue;
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) continue;
          const dhakaH = (d.getUTCHours() + 6) % 24;
          const diff = Math.abs(dhakaH - wantH);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = rec;
          }
        }
        if (best && bestDiff <= 1) {
          applyRec({ ...best, hourSlot: want }, prevSet, prevDay);
        }
      }

      const anyRing = Object.values(next).some(
        (cell) => cell?.rings && Object.values(cell.rings).some(Boolean)
      );
      if (anyRing) setSheetMode("ring");

      setGrid(next);
      setExistingIds(ids);
      setSourceMap(src);
      setBusSource({});
      setEditingRows({});
      setGenerated(false);
      setBulkEditMode(false);
      setMeta(null);

      const prevLoaded = PREV_CONTEXT_SLOTS.filter((s) =>
        FEEDERS.some((f) => {
          const v = parseFloat(next[s]?.amps?.[f.id]);
          return Number.isFinite(v) && String(next[s]?.amps?.[f.id]).trim() !== "";
        })
      ).length;
      if (prevLoaded < PREV_CONTEXT_SLOTS.length) {
        console.info(
          `[rest-data] prev evening loaded ${prevLoaded}/${PREV_CONTEXT_SLOTS.length} (looking at ${prevDay})`
        );
      }
    } catch (err) {
      setError(err?.message || "Failed to load day data");
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const setAmp = (slot, fid, val) => {
    setGrid((g) => {
      const cell = g[slot] || emptySlot();
      return {
        ...g,
        [slot]: {
          ...cell,
          amps: { ...(cell.amps || emptyAmps()), [fid]: val },
          rings: cell.rings || emptyRings(),
        },
      };
    });
    setSourceMap((s) => ({
      ...s,
      [slot]: { ...(s[slot] || {}), [fid]: "anchor" },
    }));
  };

  const setBus = (slot, bus, val) => {
    setGrid((g) => {
      const cell = g[slot] || emptySlot();
      return {
        ...g,
        [slot]: {
          ...cell,
          [bus]: val,
          rings: cell.rings || emptyRings(),
        },
      };
    });
    setBusSource((s) => ({
      ...s,
      [slot]: { ...(s[slot] || {}), [bus]: "anchor" },
    }));
  };

  const toggleRing = (slot, fid) => {
    setGrid((g) => {
      const cell = g[slot] || emptySlot();
      const rings = { ...(cell.rings || emptyRings()) };
      rings[fid] = !rings[fid];
      return { ...g, [slot]: { ...cell, rings } };
    });
    setSheetMode("ring");
  };

  const getRingOn = (slot, fid) => {
    const rings = grid[slot]?.rings;
    if (!rings) return false;
    return rings[fid] === true || rings[String(fid)] === true;
  };

  const enableRowEdit = (slot) =>
    setEditingRows((p) => ({ ...p, [slot]: true }));
  const disableRowEdit = (slot) =>
    setEditingRows((p) => {
      const n = { ...p };
      delete n[slot];
      return n;
    });

  const rowTotals = (slot) => {
    const cell = grid[slot];
    if (!cell) return { total: null, bottail: null };
    const buses = {
      bus1: cell.bus1 || "",
      bus2: cell.bus2 || "",
    };
    let total = 0;
    let bottail = 0;
    let any = false;
    FEEDERS.forEach((f) => {
      const amp = parseFloat(cell.amps?.[f.id]);
      if (!Number.isFinite(amp)) return;
      const v = getVoltageForFeeder(f, buses);
      const mw = computeFeederMW(amp, v);
      total += mw;
      if (BOTTAIL_11KV_IDS.includes(f.id)) bottail += mw;
      any = true;
    });
    if (!any) return { total: null, bottail: null };
    return { total, bottail };
  };

  const handleModifyAll = () => {
    if (!generated) {
      toast.error("Generate first, then modify 01:00–07:00 if needed");
      return;
    }
    setBulkEditMode(true);
    const next = {};
    OPTIONAL_REST_SLOTS.forEach((s) => {
      next[s] = true;
    });
    setEditingRows(next);
    toast.success("01:00–07:00 unlocked — edit then Save", {
      style: { fontWeight: "bold" },
    });
  };

  const handlePrimaryAction = async () => {
    if (!generated) {
      handleGenerate();
      return;
    }
    await applyToManual();
  };

  const handleGenerate = () => {
    try {
      const input = {};
      REST_SLOT_LABELS.forEach((l) => {
        const cell = grid[l];
        if (!cell) return;
        const hasAmp = FEEDERS.some((f) => {
          const v = parseFloat(cell.amps[f.id]);
          return (
            Number.isFinite(v) &&
            v >= 0 &&
            String(cell.amps[f.id]).trim() !== ""
          );
        });
        if (hasAmp || cell.bus1 || cell.bus2) input[l] = cell;
      });
      if (!input["00:00"] || !input["08:00"]) {
        toast.error("00:00 and 08:00 are required before generating");
        return;
      }
      const result = generateRestTimeData({ dayKey: day, slots: input });
      setGrid((g) => {
        const next = { ...g };
        REST_SLOT_LABELS.forEach((l) => {
          const row = result.slots[l];
          if (!row) return;
          const amps = {};
          FEEDERS.forEach((f) => {
            amps[f.id] = String(row.amps[f.id] ?? 0);
          });
          const prevRings = g[l]?.rings;
          const hasPrev =
            prevRings && Object.values(prevRings).some((v) => v === true);
          const seedRings =
            hasPrev
              ? { ...emptyRings(), ...prevRings }
              : {
                ...emptyRings(),
                ...(g["00:00"]?.rings || {}),
              };
          const rings = REQUIRED_SLOTS.includes(l)
            ? seedRings
            : hasPrev
              ? seedRings
              : emptyRings();
          next[l] = {
            amps,
            bus1: row.bus1 ? String(row.bus1) : g[l]?.bus1 || "",
            bus2: row.bus2 ? String(row.bus2) : g[l]?.bus2 || "",
            rings,
          };
        });
        return next;
      });
      const src = {};
      const bsrc = {};
      REST_SLOT_LABELS.forEach((l) => {
        src[l] = result.slots[l]?.source || {};
        bsrc[l] = result.slots[l]?.busSource || {};
      });
      setSourceMap(src);
      setBusSource(bsrc);
      setMeta(result.meta);
      setGenerated(true);
      setBulkEditMode(false);
      setEditingRows({});
      toast.success(
        result.meta.friday
          ? "Generated · Friday BRB → 0 at 07:00"
          : "Generated 01:00–07:00 — use Modify to adjust",
        { style: { fontWeight: "bold" } }
      );
    } catch (err) {
      toast.error(err?.message || "Generate failed");
    }
  };


  const saveOneSlot = async (label) => {
    if (PREV_CONTEXT_SLOTS.includes(label)) {
      toast.error("22:00–23:00 are context only — not saved from this page");
      return;
    }
    if (!REST_SLOT_LABELS.includes(label)) return;
    if (!isAuthenticated) {
      setShowLogin(true);
      toast.error("Sign in required to save");
      return;
    }
    const cell = grid[label];
    if (!cell) return;
    setSavingSlot(label);
    try {
      const amps = {};
      FEEDERS.forEach((f) => {
        amps[f.id] = cell.amps[f.id] || "0";
      });
      const busVoltages = {
        bus1: cell.bus1 || grid["00:00"]?.bus1 || grid["08:00"]?.bus1 || "0",
        bus2: cell.bus2 || grid["00:00"]?.bus2 || grid["08:00"]?.bus2 || "0",
      };
      const ringActive = {};
      FEEDERS.forEach((f) => {
        ringActive[f.id] = cell.rings?.[f.id] === true;
      });
      const payload = buildCalculationResult(amps, busVoltages, ringActive);
      payload.hourSlot = label;
      payload.isHourly = true;
      payload.calculatedAt = slotToDate(day, label);
      payload.note = payload.note || "Rest-time sheet";
      const existingId = existingIds[label];
      if (existingId) {
        await updateCalculation(existingId, payload);
        toast.success(`Updated ${label}`, { style: { fontWeight: "bold" } });
      } else {
        const res = await saveCalculation(payload);
        const newId = res?.data?._id || res?._id;
        if (newId) {
          setExistingIds((prev) => ({ ...prev, [label]: newId }));
        }
        toast.success(`Saved ${label}`, { style: { fontWeight: "bold" } });
      }
      disableRowEdit(label);
    } catch (err) {
      toast.error(err?.message || `Failed to save ${label}`);
    } finally {
      setSavingSlot(null);
    }
  };

  const applyToManual = async () => {
    if (!isAuthenticated) {
      setShowLogin(true);
      toast.error("Sign in required to save slots");
      return;
    }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const label of REST_SLOT_LABELS) {
        const cell = grid[label];
        if (!cell) continue;
        const amps = {};
        FEEDERS.forEach((f) => {
          amps[f.id] = cell.amps[f.id] || "0";
        });
        const busVoltages = {
          bus1: cell.bus1 || grid["00:00"]?.bus1 || grid["08:00"]?.bus1 || "0",
          bus2: cell.bus2 || grid["00:00"]?.bus2 || grid["08:00"]?.bus2 || "0",
        };
        const ringActive = {};
        FEEDERS.forEach((f) => {
          ringActive[f.id] = cell.rings?.[f.id] === true;
        });
        const payload = buildCalculationResult(amps, busVoltages, ringActive);
        payload.hourSlot = label;
        payload.isHourly = true;
        payload.calculatedAt = slotToDate(day, label);
        payload.note = "Rest-time generated";
        try {
          const existingId = existingIds[label];
          if (existingId) await updateCalculation(existingId, payload);
          else await saveCalculation(payload);
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok)
        toast.success(
          `Saved ${ok} slot(s)${fail ? ` (${fail} failed)` : ""}`,
          { style: { fontWeight: "bold" } }
        );
      else toast.error("No slots saved");
      await loadDay();
    } finally {
      setSaving(false);
    }
  };

  const colPct = `${100 / COL_COUNT}%`;
  const colStyleFit = { width: colPct, minWidth: COL_WIDTH };

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface-2/60 rounded-2xl border border-app overflow-hidden shadow-xl shadow-black/40">
      {/* Toolbar — same as Manual Input */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2.5 sm:py-3 bg-elevated/75 border-b border-app">
        <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
          Day
        </label>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDay((d) => shiftYmd(d, -1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-app bg-surface-2 text-slate-200 hover:bg-slate-800 hover:border-app-strong active:scale-95 transition-all"
            aria-label="Previous day"
          >
            ‹
          </button>
          <input
            type="date"
            value={day}
            max={todayKey()}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="text-xs sm:text-sm font-medium bg-surface-2 border border-app rounded-lg px-2 sm:px-2.5 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 max-w-[9.5rem] sm:max-w-none"
          />
          <button
            type="button"
            onClick={() => {
              const n = shiftYmd(day, 1);
              if (n <= todayKey()) setDay(n);
            }}
            disabled={day >= todayKey()}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-app bg-surface-2 text-slate-200 hover:bg-slate-800 hover:border-app-strong disabled:opacity-40 active:scale-95 transition-all"
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        <span className="text-xs text-slate-300 font-medium hidden sm:inline">
          {formatDayLabel(day)}
        </span>

        <label
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-bold cursor-pointer select-none transition-colors ${prevLoadedCount === 2
              ? "border-emerald-500/35 bg-emerald-950/50 text-emerald-300"
              : prevLoadedCount === 1
                ? "border-amber-500/35 bg-amber-950/50 text-amber-300"
                : "border-app bg-surface-2 text-slate-300"
            }`}
          title={`Previous evening (${shiftYmd(day, -1)}) · loaded ${prevLoadedCount}/2`}
        >
          <input
            type="checkbox"
            checked={showPrev}
            onChange={(e) => setShowPrev(e.target.checked)}
            className="accent-emerald-500"
          />
          22–23h ({prevLoadedCount}/2)
        </label>

        <div
          className="inline-flex rounded-lg border border-app bg-surface-2 p-0.5"
          role="tablist"
          aria-label="Ring mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sheetMode === "general"}
            onClick={() => setSheetMode("general")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${
              sheetMode === "general"
                ? "bg-surface-3 text-app dark:bg-slate-700 dark:text-white shadow-sm font-semibold"
                : "text-muted hover:text-app"
            }`}
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sheetMode === "ring"}
            onClick={() => setSheetMode("ring")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${
              sheetMode === "ring"
                ? "bg-amber-600 text-white shadow-sm font-semibold"
                : "text-muted hover:text-app"
            }`}
          >
            Ring
          </button>
        </div>

        {meta?.friday && (
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60 border border-amber-500/35 rounded-md px-2 py-1">
            Friday BRB rule
          </span>
        )}

        <button
          type="button"
          onClick={() => loadDay()}
          disabled={loading}
          className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-2 text-app border border-app hover:bg-surface-3 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-sm border-b border-rose-500/30">
          {error}
        </div>
      )}

      {/* Sheet */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative sheet-scroll-x">
        {loading && !Object.keys(existingIds).length && !generated ? (
          <div className="p-3">
            <SkeletonTable rows={10} columns={15} dark />
          </div>
        ) : (
          <table
            className="sheet-table night-log-table text-left border border-app"
            style={{ borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead className="sticky top-0 z-40">
              <tr className="bg-elevated text-app text-[10px] uppercase tracking-wider">
                <th className="time-header-sticky px-1 py-2.5 font-bold font-mono text-center border-b border-r border-app text-[11px] uppercase tracking-wider">
                  Time
                </th>
                <th
                  className="px-1.5 py-2.5 font-semibold text-center border-b border-r border-app bg-emerald-950/80 text-emerald-300"
                  style={colStyleFit}
                >
                  Total
                </th>
                {FEEDERS.map((f) => {
                  const col = FEEDER_COL[f.id] || { head: "bg-surface-2 text-secondary" };
                  return (
                    <th
                      key={f.id}
                      className={`px-1 py-2.5 font-semibold text-center whitespace-nowrap border-b border-r border-app ${col.head}`}
                      title={`BUS-${f.bus}`}
                      style={colStyleFit}
                    >
                      {f.name}
                    </th>
                  );
                })}
                <th
                  className="px-1 py-2.5 font-semibold text-center whitespace-nowrap bg-surface-2/95 text-slate-300 border-b border-r border-app"
                  style={colStyleFit}
                  title="H-3 + T-3"
                >
                  H3+T3
                </th>
                <th
                  className="px-1 py-2.5 font-semibold text-center whitespace-nowrap bg-surface-2/95 text-purple-300 border-b border-r border-app"
                  style={colStyleFit}
                  title={`BUS-2 (max ${BUS2_MAX_KV} kV)`}
                >
                  Bus 2
                </th>
                <th
                  className="px-1 py-2.5 font-semibold text-center whitespace-nowrap bg-surface-2/95 text-sky-300 border-b border-r border-app"
                  style={colStyleFit}
                  title={`BUS-1 (max ${BUS1_MAX_KV} kV)`}
                >
                  Bus 1
                </th>
                <th
                  className="px-1 py-2.5 font-semibold text-center bg-surface-2/95 text-slate-300 border-b border-app col-action"
                  style={colStyleFit}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleSlots.map((slot, idx) => {
                const required = REQUIRED_SLOTS.includes(slot);
                const isPrev = PREV_CONTEXT_SLOTS.includes(slot);
                const isEditing = !!editingRows[slot];
                const filled =
                  FEEDERS.some((f) => {
                    const v = parseFloat(grid[slot]?.amps?.[f.id]);
                    return Number.isFinite(v) && String(grid[slot]?.amps?.[f.id]).trim() !== "";
                  }) ||
                  !!grid[slot]?.bus1 ||
                  !!grid[slot]?.bus2;
                const alt = idx % 2 === 1;
                const rowBg = isPrev
                  ? "bg-elevated/90 hover:bg-surface-2"
                  : required
                    ? alt
                      ? "bg-purple-950/35 hover:bg-purple-950/50"
                      : "bg-purple-950/25 hover:bg-purple-950/45"
                    : filled
                      ? alt
                        ? "bg-emerald-950/30 hover:bg-emerald-950/45"
                        : "bg-emerald-950/20 hover:bg-emerald-950/40"
                      : alt
                        ? "bg-surface-2/75 hover:bg-slate-800/80"
                        : "bg-surface hover:bg-slate-800/70";
                const stickyBg = isPrev
                  ? "var(--sticky-prev)"
                  : required
                    ? "var(--sticky-purple)"
                    : filled
                      ? alt
                        ? "var(--sticky-filled-alt)"
                        : "var(--sticky-filled)"
                      : alt
                        ? "var(--sticky-odd)"
                        : "var(--sticky-even)";
                const { total, bottail } = rowTotals(slot);
                const isRestMid = OPTIONAL_REST_SLOTS.includes(slot);
                const canEditCell =
                  isEditing ||
                  isPrev ||
                  required ||
                  !generated ||
                  (bulkEditMode && isRestMid);

                return (
                  <tr key={slot} className={`group ${rowBg} border-b border-app hover:!bg-slate-800/70 transition-colors`}>
                    <td
                      className={`time-col-sticky px-1 py-1.5 text-center align-middle font-mono font-bold text-xs sm:text-[13px] tabular-nums border-b border-r border-app group-hover:!bg-[var(--sticky-hover)] ${isPrev
                          ? "text-slate-400 font-semibold"
                          : required
                            ? "text-purple-300 font-extrabold"
                            : "text-slate-100"
                        }`}
                      style={{ backgroundColor: stickyBg }}
                    >
                      <div className="inline-flex items-center justify-center gap-1 leading-tight">
                        <span>{slot}</span>
                        {required && (
                          <span className="block text-[8px] font-extrabold text-purple-300 uppercase leading-tight tracking-wider">
                            req
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-1 py-1.5 text-center font-mono font-bold tabular-nums border-b border-r border-app text-emerald-400 bg-emerald-950/15">
                      {fmtMW(total)}
                    </td>

                    {FEEDERS.map((f) => {
                      const col = FEEDER_COL[f.id] || {
                        cell: "bg-transparent",
                        input: "border-app focus:ring-emerald-500",
                      };
                      const pred = sourceMap[slot]?.[f.id] === "predicted";
                      return (
                        <td
                          key={f.id}
                          className={`px-0.5 py-0.5 text-center border-b border-r border-app ${col.cell} ${pred && !isEditing ? "ring-1 ring-inset ring-amber-400/50" : ""
                            } ${getRingOn(slot, f.id)
                              ? "ring-1 ring-inset ring-amber-400/80"
                              : ""
                            }`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            {canEditCell ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={grid[slot]?.amps?.[f.id] ?? ""}
                                onChange={(e) =>
                                  setAmp(slot, f.id, e.target.value)
                                }
                                className={`w-full max-w-full px-0.5 py-1 text-center font-mono text-[11px] font-semibold rounded border bg-elevated text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 ${col.input}`}
                              />
                            ) : (
                              <span className="font-mono text-[11px] font-semibold text-slate-200">
                                {grid[slot]?.amps?.[f.id] ?? "—"}
                                {getRingOn(slot, f.id) ? (
                                  <span className="text-amber-400 font-black text-[8px] ml-0.5">
                                    ●
                                  </span>
                                ) : null}
                              </span>
                            )}
                            {isEditing && sheetMode === "ring" ? (
                              feederAllowsRing(f.id) ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRing(slot, f.id)}
                                  className={`text-[8px] font-extrabold uppercase tracking-wide rounded px-1 py-0.5 border transition-colors ${getRingOn(slot, f.id)
                                      ? "bg-amber-600 text-white border-amber-500"
                                      : "bg-surface-2 text-slate-400 border-app hover:border-amber-400 hover:text-amber-300"
                                    }`}
                                  title={`${f.name} · ${ringPartnerHint(f.id)} · ${getRingOn(slot, f.id) ? "ON" : "OFF"
                                    }`}
                                >
                                  {getRingOn(slot, f.id) ? "R ON" : "R OFF"}
                                </button>
                              ) : (
                                <span className="text-[8px] text-slate-600 font-bold" title="No ring line">—</span>
                              )
                            ) : null}
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-1 py-1.5 text-center font-mono tabular-nums font-semibold border-b border-r border-app text-slate-200 bg-surface-2/30">
                      {fmtMW(bottail)}
                    </td>

                    <td
                      className={`px-0.5 py-0.5 text-center border-b border-r border-app bg-surface-2/25 ${busSource[slot]?.bus2 === "predicted" && !isEditing
                          ? "ring-1 ring-inset ring-amber-400/50"
                          : ""
                        }`}
                    >
                      {canEditCell ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={grid[slot]?.bus2 ?? ""}
                          onChange={(e) => setBus(slot, "bus2", e.target.value)}
                          placeholder="kV"
                          className="w-full max-w-full px-0.5 py-1 text-center font-mono text-[11px] font-semibold rounded border border-purple-500/35 bg-elevated text-purple-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      ) : (
                        <span className="font-mono text-[11px] font-semibold text-purple-300">
                          {grid[slot]?.bus2 || "—"}
                        </span>
                      )}
                    </td>

                    <td
                      className={`px-0.5 py-0.5 text-center border-b border-r border-app bg-surface-2/25 ${busSource[slot]?.bus1 === "predicted" && !isEditing
                          ? "ring-1 ring-inset ring-amber-400/50"
                          : ""
                        }`}
                    >
                      {canEditCell ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={grid[slot]?.bus1 ?? ""}
                          onChange={(e) => setBus(slot, "bus1", e.target.value)}
                          placeholder="kV"
                          className="w-full max-w-full px-0.5 py-1 text-center font-mono text-[11px] font-semibold rounded border border-sky-500/35 bg-elevated text-sky-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      ) : (
                        <span className="font-mono text-[11px] font-semibold text-sky-300">
                          {grid[slot]?.bus1 || "—"}
                        </span>
                      )}
                    </td>

                    <td className="px-1 py-1 text-center border-b border-app">
                      {isPrev ? (
                        <span className="text-[9px] text-slate-600 font-bold">—</span>
                      ) : (
                        <div className="inline-flex flex-col gap-0.5 items-center">
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => enableRowEdit(slot)}
                              className="min-w-[3rem] px-2 py-1 rounded-md text-[9px] font-extrabold uppercase text-white shadow-sm bg-sky-600 hover:bg-sky-500 active:scale-95 transition-all"
                            >
                              Modify
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={savingSlot === slot}
                                onClick={() => saveOneSlot(slot)}
                                className={`min-w-[3rem] px-2 py-1 rounded-md text-[9px] font-extrabold uppercase text-white shadow-sm active:scale-95 transition-all disabled:opacity-50 ${existingIds[slot]
                                    ? "bg-amber-600 hover:bg-amber-500"
                                    : "bg-emerald-600 hover:bg-emerald-500"
                                  }`}
                              >
                                {savingSlot === slot
                                  ? "…"
                                  : existingIds[slot]
                                    ? "Update"
                                    : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => disableRowEdit(slot)}
                                className="min-w-[3rem] px-1.5 py-0.5 rounded text-[8px] font-bold uppercase text-slate-300 border border-app bg-slate-800 hover:bg-slate-700"
                              >
                                Done
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom actions — Generate → Save, plus Modify for 01–07 */}
      <div className="flex-shrink-0 border-t border-app bg-elevated px-2.5 sm:px-3 py-2.5 sm:py-3 safe-pb">
        <div className="flex flex-wrap items-center justify-stretch sm:justify-center gap-2">
          {generated && (
            <button
              type="button"
              onClick={handleModifyAll}
              className={`flex-1 sm:flex-none min-h-[44px] min-w-0 sm:min-w-[7.5rem] px-3 sm:px-4 rounded-xl text-[11px] sm:text-[12px] font-extrabold uppercase tracking-wide border shadow-sm transition-all active:scale-[0.98] ${bulkEditMode
                  ? "bg-sky-600 text-white border-sky-500"
                  : "bg-surface-2 text-sky-300 border-sky-500/40 hover:bg-sky-950/60"
                }`}
            >
              {bulkEditMode ? "Editing…" : "Modify"}
            </button>
          )}
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={saving}
            className={`flex-1 sm:flex-none min-h-[44px] min-w-0 sm:min-w-[10rem] px-4 sm:px-5 rounded-xl text-[11px] sm:text-[12px] font-extrabold uppercase tracking-wide text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 ${generated
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50"
                : "bg-purple-600 hover:bg-purple-500 shadow-purple-950/50"
              }`}
          >
            {saving
              ? "Saving…"
              : generated
                ? "Save 00:00–08:00"
                : "Generate 01:00–07:00"}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          {generated
            ? bulkEditMode
              ? "Edit 01:00–07:00 cells, then Save."
              : "Tap Modify to unlock 01:00–07:00, or Save to write Manual/History."
            : "Fill 00:00 & 08:00 (and any mid anchors), then Generate."}
        </p>
      </div>

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={async (u, p) => {
          await login(u, p);
          setShowLogin(false);
        }}
      />
    </div>
  );
}