"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FEEDERS, feederAllowsRing, RING_BY_FEEDER } from "@/lib/constants";
import {
  LOGSHEET_SLOTS,
  formatDayLabel,
  recordSlotLabel,
  toDayKey,
} from "@/lib/logsheetSlots";
import {
  computeAmpsFromMW,
  computeFeederMW,
  getVoltageForFeeder,
  buildCalculationResult,
} from "@/lib/calculations";
import {
  fetchCalculations,
  saveCalculation,
  checkSlotConflict,
  updateCalculation,
  fetchCalculationById,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import SlotConflictModal from "./SlotConflictModal";
import LoginModal from "./LoginModal";
import SkeletonTable from "./SkeletonTable";

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function shiftYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Build calculatedAt ISO for a day + slot label */
function slotToDate(dayKey, slot) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d, slot.hour, slot.minute, 0, 0);
  return dt.toISOString();
}

function localDayBounds(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start, end };
}

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

/**
 * Manual entry sheet — logsheet-style UI for empty (or editable) hours.
 * unitMode: 'amps' | 'mw'
 */
export default function ManualEntryView({
  initialDay,
  editRecord = null,
  editRecordId = null,
  onSaved,
}) {
  const { isAuthenticated, login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [day, setDay] = useState(initialDay || todayKey());
  const [unitMode, setUnitMode] = useState("amps"); // amps | mw
  /** general = no ring inputs; ring = per-feeder ring ON/OFF on each row */
  const [sheetMode, setSheetMode] = useState("general"); // general | ring
  /** Slot labels currently unlocked for input */
  const [editingRows, setEditingRows] = useState({});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /**
   * Per-slot draft: { bus1, bus2, [feederId]: string }
   * Each hour can have its own bus voltages.
   */
  const [drafts, setDrafts] = useState({});
  const [savingSlot, setSavingSlot] = useState(null);
  const [conflict, setConflict] = useState(null);
  /** When editing a single existing record from history */
  const [editId, setEditId] = useState(editRecord?._id || editRecordId || null);
  const [editSlot, setEditSlot] = useState(null);

  const isAmps = unitMode === "amps";

  /**
   * Switch Amps ↔ MW and convert every draft feeder value with the formula:
   *   MW = (√3 × V_kV × 0.95 × I) / 1000
   *   I  = MW × 1000 / (√3 × V_kV × 0.95)
   */
  const switchUnitMode = (next) => {
    if (next === unitMode) return;
    const toMw = next === "mw";

    setDrafts((prev) => {
      const nextDrafts = { ...prev };
      for (const slot of LOGSHEET_SLOTS) {
        const label = slot.label;
        const rec = slotMap.get(label);
        const row = { ...(nextDrafts[label] || {}) };
        const buses = {
          bus1:
            row.bus1 != null && row.bus1 !== ""
              ? row.bus1
              : rec?.busVoltages?.bus1 != null
                ? String(rec.busVoltages.bus1)
                : "",
          bus2:
            row.bus2 != null && row.bus2 !== ""
              ? row.bus2
              : rec?.busVoltages?.bus2 != null
                ? String(rec.busVoltages.bus2)
                : "",
        };

        let touched = false;
        for (const f of FEEDERS) {
          let raw = row[f.id];
          if (raw == null || raw === "") {
            if (rec) {
              const ef = (rec.feeders || []).find((x) => x.id === f.id);
              if (ef) {
                raw = toMw
                  ? String(ef.amps ?? "")
                  : String(
                    Math.round(
                      (Number(ef.mw || 0) + Number.EPSILON) * 10
                    ) / 10
                  );
              }
            }
          }
          if (raw == null || raw === "") continue;
          const n = parseFloat(raw);
          if (!Number.isFinite(n) || n < 0) continue;
          const v = parseFloat(getVoltageForFeeder(f, buses)) || 0;
          if (v <= 0) continue;

          if (toMw) {
            const mw = computeFeederMW(n, v);
            row[f.id] = (
              Math.round((mw + Number.EPSILON) * 10) / 10
            ).toFixed(1);
          } else {
            const amps = computeAmpsFromMW(n, v);
            row[f.id] = String(Math.round(amps + Number.EPSILON));
          }
          touched = true;
        }
        if (touched) nextDrafts[label] = row;
      }
      return nextDrafts;
    });

    setUnitMode(next);
  };

  const applyEditRecord = useCallback((rec) => {
    if (!rec) return;
    const dk = toDayKey(rec.calculatedAt || rec.createdAt);
    if (dk) setDay(dk);
    setEditId(rec._id);
    const slot = recordSlotLabel(rec) || rec.hourSlot;
    setEditSlot(slot);
    const vals = {
      bus1:
        rec.busVoltages?.bus1 != null ? String(rec.busVoltages.bus1) : "",
      bus2:
        rec.busVoltages?.bus2 != null ? String(rec.busVoltages.bus2) : "",
    };
    const rings = {};
    for (const f of rec.feeders || []) {
      vals[f.id] = String(f.amps ?? 0);
      if (f.ringActive === true) rings[f.id] = true;
    }
    if (Object.keys(rings).length) {
      vals.rings = rings;
      setSheetMode("ring");
    }
    if (slot) {
      setDrafts((prev) => ({ ...prev, [slot]: vals }));
      setUnitMode("amps");
      setEditingRows((prev) => ({ ...prev, [slot]: true }));
    }
  }, []);

  const load = useCallback(async (d = day) => {
    setLoading(true);
    setError("");
    try {
      const pad = (ymd, delta) => {
        const [y, m, dd] = String(ymd).split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, dd + delta));
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
      };
      const res = await fetchCalculations({
        limit: 200,
        from: d ? pad(d, -1) : undefined,
        to: d ? pad(d, 1) : undefined,
      });
      setRecords(res.data || []);
    } catch (err) {
      setError(err?.message || "Failed to load");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    load(day);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill when opened with a full record
  useEffect(() => {
    if (editRecord) applyEditRecord(editRecord);
  }, [editRecord, applyEditRecord]);

  // Prefill when opened with only an id (e.g. ?edit=…)
  useEffect(() => {
    if (!editRecordId || editRecord) return;
    let cancelled = false;
    (async () => {
      try {
        const rec = await fetchCalculationById(editRecordId);
        if (!cancelled) applyEditRecord(rec);
      } catch (err) {
        if (!cancelled) toast.error(err.message || "Could not load record");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editRecordId, editRecord, applyEditRecord]);

  const slotMap = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const recDay = toDayKey(r.calculatedAt || r.createdAt);
      if (recDay && recDay !== day) continue;
      const slot = recordSlotLabel(r);
      if (!slot) continue;
      const prev = map.get(slot);
      if (!prev) {
        map.set(slot, r);
        continue;
      }
      const preferNew =
        (r.isHourly && !prev.isHourly) ||
        (r.isHourly === prev.isHourly &&
          (Number(r.totalMW) || 0) >= (Number(prev.totalMW) || 0));
      if (preferNew) map.set(slot, r);
    }
    return map;
  }, [records, day]);

  const setDraftField = (slotLabel, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [slotLabel]: {
        ...(prev[slotLabel] || {}),
        [field]: value,
      },
    }));
  };

  const getRingOn = (slotLabel, feederId, record) => {
    const draftRings = drafts[slotLabel]?.rings;
    if (draftRings && typeof draftRings === "object") {
      return (
        draftRings[feederId] === true ||
        draftRings[String(feederId)] === true
      );
    }
    if (!record) return false;
    const f = (record.feeders || []).find(
      (x) => x.id === feederId || String(x.id) === String(feederId)
    );
    return f?.ringActive === true;
  };

  const seedRingsFromRecord = (slotLabel, record) => {
    const rings = {};
    for (const f of record?.feeders || []) {
      if (f.ringActive === true) {
        rings[f.id] = true;
        rings[Number(f.id)] = true;
      }
    }
    return rings;
  };

  const toggleRingDraft = (slotLabel, feederId) => {
    if (!feederAllowsRing(feederId)) return;
    setDrafts((prev) => {
      const row = { ...(prev[slotLabel] || {}) };
      let rings = row.rings;
      if (!rings || typeof rings !== "object") {
        const rec = slotMap.get(slotLabel);
        rings = seedRingsFromRecord(slotLabel, rec);
      } else {
        rings = { ...rings };
      }
      const id = feederId;
      const currentlyOn =
        rings[id] === true || rings[String(id)] === true;
      if (currentlyOn) {
        delete rings[id];
        delete rings[String(id)];
      } else {
        rings[id] = true;
      }
      row.rings = rings;
      return { ...prev, [slotLabel]: row };
    });
  };

  const getBusDisplay = (slotLabel, which, record) => {
    const draft = drafts[slotLabel]?.[which];
    if (draft != null && draft !== "") return draft;
    if (!record?.busVoltages) return "";
    const v = record.busVoltages[which];
    return v != null && v !== "" ? String(v) : "";
  };

  const resolveSlotBuses = (slotLabel, record) => {
    const b1 = getBusDisplay(slotLabel, "bus1", record);
    const b2 = getBusDisplay(slotLabel, "bus2", record);
    return { bus1: b1, bus2: b2 };
  };

  const getDisplayValue = (slotLabel, feederId, record) => {
    const draft = drafts[slotLabel]?.[feederId];
    if (draft != null && draft !== "") return draft;
    if (!record) return "";
    const f = (record.feeders || []).find((x) => x.id === feederId);
    if (!f) return "";
    if (isAmps) {
      const a = Number(f.amps);
      if (!Number.isFinite(a)) return "";
      if (Math.abs(a - Math.round(a)) < 1e-6) return String(Math.round(a));
      return String(Math.round((a + Number.EPSILON) * 10) / 10);
    }
    const feeder = FEEDERS.find((x) => x.id === feederId);
    const buses = resolveSlotBuses(slotLabel, record);
    if (feeder) {
      const v = getVoltageForFeeder(feeder, buses);
      if (parseFloat(v) > 0 && Number(f.amps) >= 0) {
        const mw = computeFeederMW(f.amps, v);
        return (Math.round((mw + Number.EPSILON) * 10) / 10).toFixed(1);
      }
    }
    const mw = Number(f.mw || 0);
    return Number.isFinite(mw)
      ? (Math.round((mw + Number.EPSILON) * 10) / 10).toFixed(1)
      : "";
  };

  const buildPayloadFromDraft = (slot, values, busVoltages, ringActive = {}) => {
    const amps = {};
    for (const f of FEEDERS) {
      const raw = values[f.id];
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        amps[f.id] = 0;
        continue;
      }
      if (isAmps) {
        amps[f.id] = Math.round((n + Number.EPSILON) * 10) / 10;
      } else {
        const v = getVoltageForFeeder(f, busVoltages);
        amps[f.id] = Math.round(computeAmpsFromMW(n, v) + Number.EPSILON);
      }
    }
    const result = buildCalculationResult(amps, busVoltages, ringActive);
    result.feeders = result.feeders.map((f) => ({
      ...f,
      amps: isAmps
        ? Math.round((f.amps + Number.EPSILON) * 10) / 10
        : Math.round(f.amps + Number.EPSILON),
      mw: Math.round((f.mw + Number.EPSILON) * 10) / 10,
    }));
    result.totalMW =
      Math.round((result.totalMW + Number.EPSILON) * 10) / 10;
    result.bottail11kV =
      Math.round((result.bottail11kV + Number.EPSILON) * 10) / 10;
    result.hourSlot = slot.label;
    result.isHourly = true;
    result.calculatedAt = slotToDate(day, slot);
    result.note = "Manual entry";
    return result;
  };

  const validateBus = (busVoltages) => {
    if (
      !String(busVoltages.bus1).trim() ||
      !String(busVoltages.bus2).trim()
    ) {
      toast.error("Set BUS-1 and BUS-2 voltages on this hour row.");
      return false;
    }
    const b1 = parseFloat(busVoltages.bus1);
    const b2 = parseFloat(busVoltages.bus2);
    if (!Number.isFinite(b1) || b1 <= 0 || !Number.isFinite(b2) || b2 <= 0) {
      toast.error("Bus voltages must be positive numbers.");
      return false;
    }
    return true;
  };

  const doSave = async (slot, payload, replaceExistingId = null) => {
    setSavingSlot(slot.label);
    try {
      const id =
        replaceExistingId ||
        (editId && editSlot === slot.label ? editId : null);
      if (id) {
        if (replaceExistingId && replaceExistingId !== editId) {
          await saveCalculation({ ...payload, replaceExistingId: id });
          toast.success(`Replaced ${slot.label}`);
        } else {
          await updateCalculation(id, payload);
          toast.success(`Updated ${slot.label}`);
        }
      } else {
        await saveCalculation(payload);
        toast.success(`Saved ${slot.label}`);
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[slot.label];
        return next;
      });
      setEditingRows((prev) => {
        const next = { ...prev };
        delete next[slot.label];
        return next;
      });
      if (editId && editSlot === slot.label) {
        setEditId(null);
        setEditSlot(null);
      }
      await load(day);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingSlot(null);
      setConflict(null);
    }
  };

  const handleSaveSlot = async (slot) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }

    const existing = slotMap.get(slot.label);
    const busVoltages = resolveSlotBuses(slot.label, existing);
    if (!validateBus(busVoltages)) return;

    const values = drafts[slot.label] || {};
    const hasAny = FEEDERS.some((f) => {
      const v = parseFloat(values[f.id]);
      return Number.isFinite(v) && v > 0;
    });
    if (!hasAny && !existing) {
      toast.error("Enter at least one feeder value.");
      return;
    }

    const merged = {};
    for (const f of FEEDERS) {
      if (values[f.id] != null && values[f.id] !== "") {
        merged[f.id] = values[f.id];
      } else if (existing) {
        const ef = (existing.feeders || []).find((x) => x.id === f.id);
        if (ef) {
          merged[f.id] = isAmps
            ? String(ef.amps ?? 0)
            : String(
              Math.round((Number(ef.mw || 0) + Number.EPSILON) * 10) / 10
            );
        } else {
          merged[f.id] = "0";
        }
      } else {
        merged[f.id] = "0";
      }
    }

    const ringActive = {};
    if (sheetMode === "ring") {
      let rings = values.rings;
      if (!rings || typeof rings !== "object") {
        rings = seedRingsFromRecord(slot.label, existing);
      }
      for (const f of FEEDERS) {
        if (rings[f.id] === true || rings[String(f.id)] === true) {
          ringActive[f.id] = true;
        }
      }
    }

    const payload = buildPayloadFromDraft(slot, merged, busVoltages, ringActive);
    payload.hasActiveRing = (payload.feeders || []).some((f) => f.ringActive === true);

    if (editId && editSlot === slot.label) {
      await doSave(slot, payload, editId);
      return;
    }

    if (existing && existing._id && !String(existing._id).startsWith("offline-")) {
      setConflict({
        slot,
        payload,
        existing,
        dateLabel: formatDayLabel(day),
      });
      return;
    }

    try {
      const { start, end } = localDayBounds(day);
      const check = await checkSlotConflict({
        hourSlot: slot.label,
        dayStart: start,
        dayEnd: end,
      });
      if (check.exists && check.data?._id) {
        setConflict({
          slot,
          payload,
          existing: check.data,
          dateLabel: formatDayLabel(day),
        });
        return;
      }
    } catch {
      // proceed if check fails
    }

    await doSave(slot, payload);
  };


  const getBottailDisplay = (slotLabel, record) => {
    const buses = resolveSlotBuses(slotLabel, record);
    const draft = drafts[slotLabel] || {};
    const hasBus =
      String(buses.bus1).trim() && String(buses.bus2).trim();
    if (hasBus) {
      try {
        const merged = {};
        for (const f of FEEDERS) {
          merged[f.id] =
            draft[f.id] != null && draft[f.id] !== ""
              ? draft[f.id]
              : getDisplayValue(slotLabel, f.id, record) || "0";
        }
        const ringPreview = {};
        if (sheetMode === "ring") {
          for (const ff of FEEDERS) {
            if (getRingOn(slotLabel, ff.id, record)) ringPreview[ff.id] = true;
          }
        }
        const slotObj = { label: slotLabel };
        const p = buildPayloadFromDraft(slotObj, merged, buses, ringPreview);
        if (isAmps) {
          const a = (p.feeders || [])
            .filter((f) => f.id === 8 || f.id === 9)
            .reduce((s, f) => s + (Number(f.amps) || 0), 0);
          return String(Math.round(a + Number.EPSILON));
        }
        return (
          Math.round((Number(p.bottail11kV) + Number.EPSILON) * 10) / 10
        ).toFixed(1);
      } catch {
        /* fall through */
      }
    }
    if (!record) return "—";
    if (isAmps) {
      const a = (record.feeders || [])
        .filter((f) => f.id === 8 || f.id === 9)
        .reduce((s, f) => s + (Number(f.amps) || 0), 0);
      return String(Math.round(a + Number.EPSILON));
    }
    const mw = Number(record.bottail11kV) || 0;
    return (Math.round((mw + Number.EPSILON) * 10) / 10).toFixed(1);
  };

  const getTotalDisplay = (slotLabel, record) => {
    const buses = resolveSlotBuses(slotLabel, record);
    const draft = drafts[slotLabel] || {};
    const hasBus =
      String(buses.bus1).trim() && String(buses.bus2).trim();
    if (hasBus) {
      try {
        const merged = {};
        for (const f of FEEDERS) {
          merged[f.id] =
            draft[f.id] != null && draft[f.id] !== ""
              ? draft[f.id]
              : getDisplayValue(slotLabel, f.id, record) || "0";
        }
        const slotObj = { label: slotLabel };
        const p = buildPayloadFromDraft(slotObj, merged, buses, {});
        if (isAmps) {
          const a = (p.feeders || []).reduce(
            (s, f) => s + (Number(f.amps) || 0),
            0
          );
          return String(Math.round(a + Number.EPSILON));
        }
        return (
          Math.round((Number(p.totalMW) + Number.EPSILON) * 10) / 10
        ).toFixed(1);
      } catch {
        /* fall through */
      }
    }
    if (!record) return "—";
    if (isAmps) {
      const a = (record.feeders || []).reduce(
        (s, f) => s + (Number(f.amps) || 0),
        0
      );
      return String(Math.round(a + Number.EPSILON));
    }
    const mw = Number(record.totalMW) || 0;
    return (Math.round((mw + Number.EPSILON) * 10) / 10).toFixed(1);
  };

  const enableRowEdit = (slotLabel) => {
    setEditingRows((prev) => ({ ...prev, [slotLabel]: true }));
    setDrafts((prev) => {
      const row = { ...(prev[slotLabel] || {}) };
      if (!row.rings) {
        const rec = slotMap.get(slotLabel);
        row.rings = seedRingsFromRecord(slotLabel, rec);
      }
      return { ...prev, [slotLabel]: row };
    });
  };

  const disableRowEdit = (slotLabel) => {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[slotLabel];
      return next;
    });
  };

  const emptyCount = LOGSHEET_SLOTS.filter((s) => !slotMap.has(s.label)).length;

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface-2/60 rounded-2xl border border-app overflow-hidden shadow-xl shadow-black/40">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-col gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 bg-elevated/75 border-b border-app">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted shrink-0">
            Day
          </label>
          <div className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-app bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setDay((d) => shiftYmd(d, -1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-app bg-surface-2 text-secondary hover:bg-surface-3 hover:border-app-strong transition-colors"
              aria-label="Previous day"
            >
              ‹
            </button>
            <input
              type="date"
              value={day}
              max={todayKey()}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="text-xs sm:text-sm font-medium bg-transparent sm:bg-surface-2 border-0 sm:border border-app rounded-lg px-1.5 sm:px-2.5 py-1.5 text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 min-w-0"
            />
            <button
              type="button"
              onClick={() => {
                const n = shiftYmd(day, 1);
                if (n <= todayKey()) setDay(n);
              }}
              disabled={day >= todayKey()}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-app bg-surface-2 text-secondary hover:bg-surface-3 hover:border-app-strong disabled:opacity-40 transition-colors"
              aria-label="Next day"
            >
              ›
            </button>
          </div>
          <span className="text-xs text-slate-300 font-medium hidden sm:inline">
            {formatDayLabel(day)}
          </span>

          <div
            className="inline-flex rounded-lg border border-app bg-surface-2 p-0.5"
            role="tablist"
            aria-label="Input unit"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isAmps}
              onClick={() => switchUnitMode("amps")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${isAmps ? "bg-sky-600 text-white shadow-sm" : "text-muted hover:text-secondary"
                }`}
            >
              Amps
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isAmps}
              onClick={() => switchUnitMode("mw")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${!isAmps ? "bg-sky-600 text-white shadow-sm" : "text-muted hover:text-secondary"
                }`}
            >
              MW
            </button>
          </div>

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
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${sheetMode === "general"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-muted hover:text-secondary"
                }`}
            >
              General
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sheetMode === "ring"}
              onClick={() => {
                setSheetMode("ring");
                setDrafts((prev) => {
                  const next = { ...prev };
                  for (const label of Object.keys(editingRows)) {
                    if (!editingRows[label]) continue;
                    const row = { ...(next[label] || {}) };
                    if (!row.rings) {
                      row.rings = seedRingsFromRecord(label, slotMap.get(label));
                      next[label] = row;
                    }
                  }
                  return next;
                });
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${sheetMode === "ring"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-muted hover:text-secondary"
                }`}
              title="Enter ring ON/OFF for each feeder"
            >
              Ring mode
            </button>
          </div>

          <span className="text-xs text-muted tabular-nums">
            {26 - emptyCount}/26 slots · {isAmps ? "Amps" : "MW"} input
          </span>

          <button
            type="button"
            onClick={() => load(day)}
            disabled={loading}
            className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-3 border border-app text-app hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-rose-950/60 text-rose-300 text-sm border-b border-rose-500/30">
          {error}
        </div>
      )}

      {/* Sheet */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative sheet-scroll-x">
        {loading && !records.length ? (
          <div className="p-3">
            <SkeletonTable rows={12} columns={15} dark />
          </div>
        ) : (
          <table
            className="sheet-table text-left border border-app"
            style={{ borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead className="sticky top-0 z-40">
              <tr className="bg-elevated text-secondary text-[10px] uppercase tracking-wider">
                <th className="time-header-sticky px-1 py-2.5 font-bold font-mono text-center border-b border-r border-app text-[11px] uppercase tracking-wider">
                  Time
                </th>
                <th
                  className="px-1.5 py-2.5 font-semibold text-center border-b border-r border-app bg-emerald-950/80 text-emerald-300"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: COL_WIDTH }}
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
                      style={{ width: `${100 / COL_COUNT}%`, minWidth: COL_WIDTH }}
                    >
                      {f.name}
                    </th>
                  );
                })}
                <th
                  className="px-1 py-2.5 font-semibold text-center whitespace-nowrap bg-surface-2/95 text-slate-300 border-b border-r border-app"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: COL_WIDTH }}
                  title="H-3 + T-3"
                >
                  H3+T3
                </th>
                <th
                  className="px-1 py-2.5 font-semibold text-center whitespace-nowrap bg-surface-2/95 text-purple-300 border-b border-r border-app"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: COL_WIDTH }}
                  title="BUS-2 voltage (kV) — per hour"
                >
                  Bus 2
                </th>
                <th
                  className="px-1 py-2.5 font-semibold text-center whitespace-nowrap bg-surface-2/95 text-sky-300 border-b border-r border-app"
                  style={{ width: `${100 / COL_COUNT}%`, minWidth: COL_WIDTH }}
                  title="BUS-1 voltage (kV) — per hour"
                >
                  Bus 1
                </th>
                <th
                  className="px-0.5 py-2.5 font-semibold text-center bg-surface-2/95 text-slate-300 border-b border-app col-action"
                  style={{ width: "5.5rem", minWidth: "5.5rem", maxWidth: "5.5rem" }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {LOGSHEET_SLOTS.map((slot, idx) => {
                const rec = slotMap.get(slot.label);
                const filled = !!rec;
                const isEditTarget = editSlot === slot.label;
                const isEditing = !!editingRows[slot.label] || isEditTarget;
                const alt = idx % 2 === 1;
                const rowBg = slot.isSpecial
                  ? "bg-amber-950/30 hover:bg-amber-950/50"
                  : filled
                    ? alt
                      ? "bg-emerald-950/30 hover:bg-emerald-950/45"
                      : "bg-emerald-950/20 hover:bg-emerald-950/40"
                    : alt
                      ? "bg-surface-2/75 hover:bg-surface-3/80"
                      : "bg-surface hover:bg-surface-3/70";
                const stickyBg = slot.isSpecial
                  ? "var(--sticky-special)"
                  : filled
                    ? alt
                      ? "var(--sticky-filled-alt)"
                      : "var(--sticky-filled)"
                    : alt
                      ? "var(--sticky-odd)"
                      : "var(--sticky-even)";
                const draft = drafts[slot.label] || {};
                const buses = resolveSlotBuses(slot.label, rec);

                let totalPreview = null;
                let bottailPreview = null;
                if (Object.keys(draft).length || filled) {
                  try {
                    if (
                      String(buses.bus1).trim() &&
                      String(buses.bus2).trim()
                    ) {
                      const merged = {};
                      for (const f of FEEDERS) {
                        merged[f.id] =
                          draft[f.id] != null && draft[f.id] !== ""
                            ? draft[f.id]
                            : getDisplayValue(slot.label, f.id, rec) || "0";
                      }
                      const ringPreview = {};
                      if (sheetMode === "ring") {
                        const rings = draft.rings || {};
                        for (const ff of FEEDERS) {
                          if (
                            rings[ff.id] === true ||
                            rings[String(ff.id)] === true ||
                            getRingOn(slot.label, ff.id, rec)
                          ) {
                            if (draft.rings) {
                              if (
                                rings[ff.id] === true ||
                                rings[String(ff.id)] === true
                              )
                                ringPreview[ff.id] = true;
                            } else if (getRingOn(slot.label, ff.id, rec)) {
                              ringPreview[ff.id] = true;
                            }
                          }
                        }
                      }
                      const p = buildPayloadFromDraft(
                        slot,
                        merged,
                        buses,
                        ringPreview
                      );
                      totalPreview = p.totalMW;
                      bottailPreview = p.bottail11kV;
                    }
                  } catch {
                    /* ignore */
                  }
                }
                if (totalPreview == null && filled) {
                  totalPreview = Number(rec.totalMW) || 0;
                  bottailPreview = Number(rec.bottail11kV) || 0;
                }

                const fmt = (v) =>
                  v != null && Number.isFinite(Number(v))
                    ? (
                      Math.round((Number(v) + Number.EPSILON) * 10) / 10
                    ).toFixed(1)
                    : "—";

                const dataRow = (
                  <tr
                    key={slot.label}
                    className={`text-xs group transition-colors duration-150 ${rowBg} hover:!bg-surface-3/70 ${isEditTarget ? "ring-2 ring-inset ring-emerald-500" : ""
                      }`}
                  >
                    <td
                      className={`time-col-sticky px-1 py-1.5 text-center align-middle font-mono font-bold text-xs sm:text-[13px] tabular-nums border-b border-r border-app group-hover:!bg-[var(--sticky-hover)] ${slot.isSpecial
                          ? "text-amber-300 font-extrabold"
                          : "text-app"
                        }`}
                      style={{ backgroundColor: stickyBg }}
                    >
                      <div className="inline-flex items-center justify-center gap-1 leading-tight">
                        <span className="tabular-nums">{slot.label}</span>
                        {filled && (
                          <span
                            className="inline-flex items-center justify-center text-emerald-400 shrink-0"
                            title="Recorded & saved"
                            aria-label="Saved"
                          >
                            <svg
                              className="w-3.5 h-3.5 stroke-[2.5]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m4.5 12.75 6 6 9-13.5"
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-2 py-1.5 text-center font-mono font-bold tabular-nums border-b border-r border-app text-emerald-400 bg-emerald-950/15"
                    >
                      {getTotalDisplay(slot.label, rec)}
                    </td>
                    {FEEDERS.map((f) => {
                      const col = FEEDER_COL[f.id] || {
                        cell: "bg-transparent",
                        input: "border-app focus:ring-emerald-500",
                      };
                      const ringOn = getRingOn(slot.label, f.id, rec);
                      const showRing = sheetMode === "ring";
                      const val = getDisplayValue(slot.label, f.id, rec);
                      return (
                        <td
                          key={f.id}
                          className={`px-0.5 py-0.5 text-center border-b border-r border-app ${col.cell} ${showRing && ringOn
                            ? "ring-1 ring-inset ring-amber-400/80"
                            : ""
                            }`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            {isEditing ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={val}
                                onChange={(e) =>
                                  setDraftField(
                                    slot.label,
                                    f.id,
                                    e.target.value
                                  )
                                }
                                placeholder="—"
                                className={`w-full min-w-0 px-0.5 py-1.5 text-center font-mono text-[11px] tabular-nums rounded border bg-elevated text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 ${col.input}`}
                              />
                            ) : (
                              <span className={`font-mono text-[11px] tabular-nums ${val !== "" ? "text-app" : "text-slate-600"}`}>
                                {val !== "" ? val : "—"}
                                {showRing && ringOn ? (
                                  <span className="text-amber-400 font-black text-[8px] ml-0.5">
                                    ●
                                  </span>
                                ) : null}
                              </span>
                            )}
                            {isEditing && showRing ? (
                              feederAllowsRing(f.id) ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleRingDraft(slot.label, f.id)
                                  }
                                  className={`text-[8px] font-extrabold uppercase tracking-wide rounded px-1 py-0.5 border transition-colors ${ringOn
                                    ? "bg-amber-600 text-white border-amber-500"
                                    : "bg-surface-2 text-muted border-app hover:border-amber-400 hover:text-amber-300"
                                    }`}
                                  title={(RING_BY_FEEDER[f.id]?.partner || f.name) + ` · ring ${ringOn ? "ON" : "OFF"}`}
                                >
                                  {ringOn ? "R ON" : "R OFF"}
                                </button>
                              ) : (
                                <span className="text-[8px] text-slate-600 font-bold" title="No ring line">—</span>
                              )
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-1.5 py-1.5 text-center font-mono tabular-nums font-semibold border-b border-r border-app text-secondary bg-surface-2/30">
                      {getBottailDisplay(slot.label, rec)}
                    </td>
                    <td className="px-0.5 py-0.5 text-center border-b border-r border-app bg-surface-2/25">
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getBusDisplay(slot.label, "bus2", rec)}
                          onChange={(e) =>
                            setDraftField(slot.label, "bus2", e.target.value)
                          }
                          placeholder="kV"
                          className="w-full min-w-0 px-0.5 py-1 text-center font-mono text-[11px] font-semibold rounded border border-purple-500/35 bg-elevated text-purple-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      ) : (
                        <span className="font-mono text-[11px] font-semibold text-purple-300">
                          {getBusDisplay(slot.label, "bus2", rec) || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-0.5 py-0.5 text-center border-b border-r border-app bg-surface-2/25">
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getBusDisplay(slot.label, "bus1", rec)}
                          onChange={(e) =>
                            setDraftField(slot.label, "bus1", e.target.value)
                          }
                          placeholder="kV"
                          className="w-full min-w-0 px-0.5 py-1 text-center font-mono text-[11px] font-semibold rounded border border-sky-500/35 bg-elevated text-sky-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      ) : (
                        <span className="font-mono text-[11px] font-semibold text-sky-300">
                          {getBusDisplay(slot.label, "bus1", rec) || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1 text-center border-b border-app">
                      <div className="inline-flex flex-col gap-0.5 items-center">
                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => enableRowEdit(slot.label)}
                            className="w-full max-w-full px-1 py-1 rounded-md text-[9px] font-extrabold uppercase text-white shadow-sm bg-sky-600 hover:bg-sky-500 active:scale-95 transition-all"
                          >
                            Edit
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={savingSlot === slot.label}
                              onClick={() => handleSaveSlot(slot)}
                              className={`w-full max-w-full px-1 py-1 rounded-md text-[9px] font-extrabold uppercase text-white shadow-sm active:scale-95 transition-all disabled:opacity-50 ${filled
                                ? "bg-amber-600 hover:bg-amber-500"
                                : "bg-emerald-600 hover:bg-emerald-500"
                                }`}
                            >
                              {savingSlot === slot.label
                                ? "…"
                                : filled
                                  ? "Update"
                                  : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => disableRowEdit(slot.label)}
                              className="w-full max-w-full px-1.5 py-0.5 rounded text-[8px] font-bold uppercase text-slate-300 border border-app bg-surface-3 hover:bg-slate-700"
                            >
                              Done
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );

                if (
                  slot.label === "08:00" ||
                  slot.label === "14:00" ||
                  slot.label === "20:00"
                ) {
                  return [
                    dataRow,
                    <tr key={`blank-after-${slot.label}`} className="h-3 separator-row">
                      <td
                        colSpan={3 + FEEDERS.length + 4}
                        className="border-b border-app bg-elevated p-0"
                        style={{ height: "0.75rem", position: "static", width: "auto" }}
                      />
                    </tr>,
                  ];
                }
                return [dataRow];
              })}
            </tbody>
          </table>
        )}
      </div>

      <SlotConflictModal
        open={!!conflict}
        slotLabel={conflict?.slot?.label}
        dateLabel={conflict?.dateLabel}
        existingTotalMW={conflict?.existing?.totalMW}
        existingTime={
          conflict?.existing?.calculatedAt
            ? new Date(conflict.existing.calculatedAt).toLocaleTimeString(
              "en-GB",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }
            )
            : null
        }
        loading={!!savingSlot}
        onProceed={() =>
          doSave(
            conflict.slot,
            conflict.payload,
            conflict.existing?._id
          )
        }
        onCalculateOnly={() => setConflict(null)}
        onKeepPrevious={() => setConflict(null)}
      />

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={async (username, password) => {
          await login(username, password);
          setShowLogin(false);
        }}
      />
    </div>
  );
}