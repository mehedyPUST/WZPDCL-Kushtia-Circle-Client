"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";

import StationHeader from "./StationHeader";
import LiveClock from "./LiveClock";
import ModeToggle from "./ModeToggle";
import BusVoltagePanel from "./BusVoltagePanel";
import LoadShedPanel from "./LoadShedPanel";
import FeederTable from "./FeederTable";
import ResultsPanel from "./ResultsPanel";
import ActionBar from "./ActionBar";
import AppFooter from "./AppFooter";
import ErrorBoundary from "./ErrorBoundary";
import { useRouter } from "next/navigation";

import {
  createInitialAmps,
  createInitialCurrentLs,
  getFeederMW,
  buildCalculationResult,
  buildLoadShedPlan,
} from "@/lib/calculations";
import { LS_PROTECTED_IDS, feederAllowsRing } from "@/lib/constants";
import {
  saveCalculation,
  updateCalculation,
  checkSlotConflict,
  saveCalculatorRingActive,
} from "@/lib/api";
import { enqueuePendingSave, isOfflineError } from "@/lib/offlineQueue";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import OfflineBadge from "./OfflineBadge";
import ThemeToggle from "./ThemeToggle";
import { useNumberInputGuards } from "@/hooks/useNumberInputGuards";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { getNearestHourSlot } from "@/lib/hourSlot";
import SlotConflictModal from "./SlotConflictModal";

function localDayBounds(refDate = new Date()) {
  const start = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate() + 1,
    0,
    0,
    0,
    0
  );
  return { start, end };
}

export default function Calculator({ editRecord = null, embedded = false, onClose, onSaved } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState("normal");
  const [busVoltages, setBusVoltages] = useState({ bus1: "", bus2: "" });
  const [amps, setAmps] = useState(createInitialAmps);
  const [calculated, setCalculated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allotment, setAllotment] = useState("");
  const [currentLs, setCurrentLs] = useState(createInitialCurrentLs);
  // Empty on server + first client paint (avoids hydration mismatch).
  // Restore from localStorage then DB only after mount.
  const [ringActive, setRingActive] = useState({});
  const [hourSlot, setHourSlot] = useState(() => getNearestHourSlot());
  const [slotConflict, setSlotConflict] = useState(null); // { payload, existing, slot, dateLabel }

  const { handleWheel, handleKeyDown } = useNumberInputGuards();

  // Embed / history edit: load record into calculator fields
  useEffect(() => {
    if (!editRecord) return;
    const nextAmps = createInitialAmps();
    const rings = {};
    for (const f of editRecord.feeders || []) {
      if (f?.id == null) continue;
      nextAmps[f.id] =
        f.amps != null && Number.isFinite(Number(f.amps))
          ? String(Math.round(Number(f.amps)))
          : "0";
      if (f.ringActive) rings[f.id] = true;
    }
    setAmps(nextAmps);
    setRingActive(rings);
    setBusVoltages({
      bus1:
        editRecord.busVoltages?.bus1 != null
          ? String(editRecord.busVoltages.bus1)
          : "",
      bus2:
        editRecord.busVoltages?.bus2 != null
          ? String(editRecord.busVoltages.bus2)
          : "",
    });
    if (editRecord.allotment != null && Number.isFinite(Number(editRecord.allotment))) {
      setAllotment(String(editRecord.allotment));
    }
    // Preserve LS if present on feeders
    const ls = createInitialCurrentLs();
    for (const f of editRecord.feeders || []) {
      if (f?.id != null && f.lsMW != null && Number(f.lsMW) > 0) {
        ls[f.id] = String(f.lsMW);
      }
    }
    setCurrentLs(ls);
    if (editRecord.hourSlot) {
      setHourSlot((prev) => ({
        ...(prev || {}),
        label: editRecord.hourSlot,
        isSpecial: !!editRecord.hourSlot && String(editRecord.hourSlot).includes("30"),
        date: editRecord.calculatedAt
          ? new Date(editRecord.calculatedAt)
          : prev?.date || new Date(),
      }));
    }
    setCalculated(true);
    setMode("normal");
  }, [editRecord]);



  useEffect(() => {
    if (editRecord) return;
    setHourSlot(getNearestHourSlot());
  }, [editRecord]);

  // Restore ring toggles from local storage after mount without unsolicited network sync.
  // Server persistence happens strictly on explicit user ring toggle actions.
  useEffect(() => {
    if (editRecord) return;

    const toRingMap = (obj) => {
      const map = {};
      if (!obj || typeof obj !== "object") return map;
      for (const [k, v] of Object.entries(obj)) {
        if (v === true || v === "true" || v === 1) {
          const id = Number(k);
          map[Number.isFinite(id) ? id : k] = true;
        }
      }
      return map;
    };

    try {
      const raw = localStorage.getItem("calculatorRingActive");
      if (raw) {
        const localMap = toRingMap(JSON.parse(raw));
        if (Object.keys(localMap).length > 0) {
          setRingActive(localMap);
        }
      }
    } catch {
      /* ignore */
    }
  }, [editRecord]);

  const { pendingCount, syncing, online, syncPending, refreshCount } =
    useOfflineSync({
      enabled: true,
      onSynced: (n) => {
        toast.success(
          n === 1
            ? "1 offline save synced to server."
            : `${n} offline saves synced to server.`,
          { icon: "☁", style: { fontWeight: "bold" } }
        );
      },
    });

  const totals = calculated
    ? buildCalculationResult(amps, busVoltages, ringActive)
    : { totalMW: 0, bottail11kV: 0 };

  const loadShedPlan = useMemo(() => {
    if (!calculated || mode !== "loadShed") return null;
    return buildLoadShedPlan(amps, busVoltages, allotment, {
      excludeIds: [...LS_PROTECTED_IDS],
      currentLsMW: currentLs,
    });
  }, [calculated, mode, amps, busVoltages, allotment, currentLs]);

  useEffect(() => {
    if (embedded) return;
    if (calculated && totals.totalMW > 0) {
      document.title = `${Math.round(totals.totalMW)} MW | WZPDCL Load Calculator`;
    } else {
      document.title = "WZPDCL Load Calculator | Bottail-Kushtia";
    }
    return () => {
      document.title = "WZPDCL Load Calculator | Bottail-Kushtia";
    };
  }, [calculated, totals.totalMW, embedded]);

  const handleBusVoltageChange = (bus, value) => {
    setBusVoltages((prev) => ({ ...prev, [bus]: value }));
    setCalculated(false);
  };

  const handleAmpChange = (id, value) => {
    setAmps((prev) => ({ ...prev, [id]: value }));
    setCalculated(false);
  };

  const handleAmpBlur = (id) => {
    if (!amps[id] || amps[id].trim() === "") {
      setAmps((prev) => (prev[id] === "" ? prev : { ...prev, [id]: "" }));
    }
  };

  const handleAllotmentChange = (value) => {
    setAllotment(value);
  };

  const handleCurrentLsChange = (id, value) => {
    setCurrentLs((prev) => ({ ...prev, [id]: value }));
    setCalculated(false);
  };

  const handleCurrentLsBlur = (id) => {
    if (!currentLs[id] || currentLs[id].trim() === "") {
      setCurrentLs((prev) => (prev[id] === "" ? prev : { ...prev, [id]: "" }));
    }
  };

  const getDisplayMW = (id) => {
    if (!calculated) return null;
    const mw = getFeederMW(id, amps, busVoltages);
    return mw > 0 ? mw : 0;
  };

  const validateVoltages = () => {
    const b1Raw = String(busVoltages.bus1 ?? "").trim();
    const b2Raw = String(busVoltages.bus2 ?? "").trim();
    if (!b1Raw || !b2Raw) {
      toast.error("BUS-1 and BUS-2 voltages are mandatory — please fill both.", {
        style: { fontWeight: "bold" },
      });
      return false;
    }
    const b1 = parseFloat(b1Raw);
    const b2 = parseFloat(b2Raw);
    if (!Number.isFinite(b1) || b1 <= 0 || !Number.isFinite(b2) || b2 <= 0) {
      toast.error("Enter valid positive kV values for both BUS-1 and BUS-2.", {
        style: { fontWeight: "bold" },
      });
      return false;
    }
    return true;
  };

  const handleCalculateOnly = () => {
    if (!validateVoltages()) return;
    setCalculated(true);
    toast.success("Load calculated successfully.", {
      style: { fontWeight: "bold" },
    });
  };

  const handleCalculateLoadShed = () => {
    if (!validateVoltages()) return;
    const a = parseFloat(allotment);
    if (!Number.isFinite(a) || a < 0) {
      toast.error("Enter a valid allotment (MW).", {
        style: { fontWeight: "bold" },
      });
      return;
    }
    setCalculated(true);
    const plan = buildLoadShedPlan(amps, busVoltages, allotment, {
      excludeIds: [...LS_PROTECTED_IDS],
      currentLsMW: currentLs,
    });
    if (plan.needsShed) {
      toast.success(
        `LS plan ready — shed ${(Math.round((plan.shedTotalMW + Number.EPSILON) * 10) / 10).toFixed(1)} MW (${plan.shedPercent.toFixed(1)}%)`,
        { style: { fontWeight: "bold" }, icon: "⚡" }
      );
    } else {
      toast.success("Within allotment — no load shed needed.", {
        style: { fontWeight: "bold" },
        icon: "✅",
      });
    }
  };

  const queueOffline = async (payload) => {
    await enqueuePendingSave(payload);
    await refreshCount();
    toast.success("Saved offline — open History to review pending sync.", {
      icon: "📡",
      style: { fontWeight: "bold" },
      duration: 4500,
    });
  };

  const handleRingToggle = (feederId) => {
    if (!feederAllowsRing(feederId)) return;
    setRingActive((prev) => {
      const id = feederId;
      const currentlyOn = !!(prev[id] || prev[String(id)]);
      const next = { ...prev };
      // Clear both key forms
      delete next[id];
      delete next[String(id)];
      if (!currentlyOn) {
        next[id] = true;
      }
      // Sync write localStorage first so reload cannot lose state
      try {
        const plain = {};
        for (const [k, v] of Object.entries(next)) {
          if (v === true) plain[String(k)] = true;
        }
        localStorage.setItem("calculatorRingActive", JSON.stringify(plain));
      } catch {
        /* ignore */
      }
      // Then persist to database
      saveCalculatorRingActive(next).catch(() => {});
      return next;
    });
  };

  const goHistory = () => {
    if (embedded && typeof onClose === "function") {
      onClose();
      return;
    }
    router.push("/history");
  };

  const persistPayload = async (payload, successMsg) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await queueOffline(payload);
      } catch (qErr) {
        toast.error(qErr.message || "Could not save offline", {
          style: { fontWeight: "bold" },
        });
      }
      return;
    }

    try {
      await saveCalculation(payload);
      toast.success(successMsg, {
        icon: "💾",
        style: { fontWeight: "bold" },
      });
      await refreshCount();
    } catch (err) {
      const msg = String(err?.message || "");
      const authFail =
        msg.toLowerCase().includes("log in") ||
        msg.includes("401") ||
        msg.toLowerCase().includes("authentication");
      if (!authFail && (isOfflineError(err) || msg.includes("Cannot reach"))) {
        try {
          await queueOffline(payload);
        } catch (qErr) {
          toast.error(qErr.message || "Could not queue offline save", {
            style: { fontWeight: "bold" },
          });
        }
      } else {
        toast.error(err.message || "Save failed", {
          style: { fontWeight: "bold" },
        });
      }
    }
  };

  const handleCalculateAndSave = async () => {
    if (!validateVoltages()) return;
    setCalculated(true);
    setIsSaving(true);
    const payload = buildCalculationResult(amps, busVoltages, ringActive);
    try {
      await persistPayload(payload, "Calculation saved to database.");
    } finally {
      setIsSaving(false);
    }
  };

  /** Calculate & save stamped to nearest hour slot (incl. 18:30 / 19:30) */
  const handleCalculateAndSaveHour = async () => {
    if (!validateVoltages()) return;
    const slot = getNearestHourSlot();
    setHourSlot(slot);
    setCalculated(true);
    const base = buildCalculationResult(amps, busVoltages, ringActive);
    const payload = {
      ...base,
      calculatedAt: slot.date.toISOString(),
      hourSlot: slot.label,
      isHourly: true,
      note: slot.isSpecial
        ? `Hourly save · special slot ${slot.label}`
        : `Hourly save · ${slot.label}`,
    };

    const dateLabel = slot.date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Offline: skip conflict check (will resolve on sync later)
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsSaving(true);
      try {
        await persistPayload(
          payload,
          `Saved offline for ${slot.label}${slot.isSpecial ? " (special)" : ""}.`
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    try {
      const { start, end } = localDayBounds(slot.date);
      const check = await checkSlotConflict({
        hourSlot: slot.label,
        dayStart: start,
        dayEnd: end,
      });
      if (check.exists && check.data?._id) {
        setIsSaving(false);
        setSlotConflict({
          payload,
          existing: check.data,
          slot,
          dateLabel,
        });
        return;
      }
      await persistPayload(
        payload,
        `Saved for ${slot.label}${slot.isSpecial ? " (special)" : ""}.`
      );
    } catch (err) {
      // If check fails (e.g. network), still allow save attempt
      const msg = String(err?.message || "");
      if (isOfflineError(err) || msg.includes("Cannot reach")) {
        try {
          await persistPayload(payload, `Saved offline for ${slot.label}.`);
        } catch {
          toast.error(err.message || "Could not save", {
            style: { fontWeight: "bold" },
          });
        }
      } else {
        toast.error(err.message || "Could not check existing slot", {
          style: { fontWeight: "bold" },
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSlotProceed = async () => {
    if (!slotConflict) return;
    const { payload, existing, slot } = slotConflict;
    setIsSaving(true);
    try {
      await persistPayload(
        { ...payload, replaceExistingId: existing._id },
        `Replaced data for ${slot.label}.`
      );
      setSlotConflict(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSlotCalculateOnly = () => {
    setSlotConflict(null);
    setCalculated(true);
    toast.success("Calculated only — previous slot data kept.", {
      icon: "🧮",
      style: { fontWeight: "bold" },
    });
  };

  const handleSlotKeepPrevious = () => {
    setSlotConflict(null);
    toast("Previous slot data kept. Nothing was saved.", {
      icon: "ℹ️",
      style: { fontWeight: "bold" },
    });
  };

  const handleCopyTotal = async () => {
    const mwValue = calculated ? Math.round(totals.totalMW) : 0;
    const text = `Bottail : ${mwValue} MW`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied: ${text}`, {
        icon: "📋",
        style: { fontWeight: "bold" },
      });
    } catch {
      toast.error("Failed to copy text.");
    }
  };

  const handleCopyLoadShed = async () => {
    if (!loadShedPlan?.valid) {
      toast.error("Calculate LS plan first.", { style: { fontWeight: "bold" } });
      return;
    }
    const lines = [
      `Bottail LS Plan · Allotment ${(Math.round((loadShedPlan.allotment + Number.EPSILON) * 10) / 10).toFixed(1)} MW`,
      `Current ${(Math.round((loadShedPlan.totalMW + Number.EPSILON) * 10) / 10).toFixed(1)} MW · Shed ${(Math.round((loadShedPlan.shedTotalMW + Number.EPSILON) * 10) / 10).toFixed(1)} MW (${loadShedPlan.shedPercent.toFixed(1)}%)`,
      "",
    ];
    loadShedPlan.feeders.forEach((f) => {
      if (f.protected) {
        lines.push(`${f.name}: ${f.amps.toFixed(0)} A / ${(Math.round((f.mw + Number.EPSILON) * 10) / 10).toFixed(1)} MW [FREE]`);
      } else if ((f.moreLsMW || 0) > 0.001 || (f.currentLsMW || 0) > 0.001) {
        lines.push(
          `${f.name}: ${f.amps.toFixed(0)} A → ${Math.round(f.targetAmps)} A | more LS ${(Math.round((f.moreLsMW + Number.EPSILON) * 10) / 10).toFixed(1)} MW | cur LS ${(Math.round((f.currentLsMW + Number.EPSILON) * 10) / 10).toFixed(1)} → total LS ${(Math.round((f.totalLsMW + Number.EPSILON) * 10) / 10).toFixed(1)} MW`
        );
      } else {
        lines.push(`${f.name}: ${f.amps.toFixed(0)} A / ${(Math.round((f.mw + Number.EPSILON) * 10) / 10).toFixed(1)} MW (no more LS)`);
      }
    });
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("LS plan copied.", {
        icon: "📋",
        style: { fontWeight: "bold" },
      });
    } catch {
      toast.error("Failed to copy.");
    }
  };


  /** History embed: update existing calculation (same payload shape as save) */
  const handleUpdateRecord = async () => {
    if (!editRecord?._id) return;
    if (!validateVoltages()) return;
    setCalculated(true);
    setIsSaving(true);
    try {
      const base = buildCalculationResult(amps, busVoltages, ringActive);
      const payload = {
        ...base,
        hourSlot: editRecord.hourSlot || hourSlot?.label || null,
        isHourly: editRecord.isHourly !== false,
        calculatedAt: editRecord.calculatedAt || editRecord.createdAt,
        note: editRecord.note || "",
        allotment:
          allotment !== "" && Number.isFinite(parseFloat(allotment))
            ? parseFloat(allotment)
            : editRecord.allotment ?? null,
      };
      // preserve per-feeder LS from currentLs / existing
      payload.feeders = (payload.feeders || []).map((f) => {
        const prev = (editRecord.feeders || []).find((x) => x.id === f.id);
        const fromLs = currentLs[f.id] ?? currentLs[String(f.id)];
        const lsMW =
          fromLs != null && String(fromLs).trim() !== ""
            ? parseFloat(fromLs) || 0
            : prev?.lsMW != null
              ? Number(prev.lsMW) || 0
              : 0;
        return { ...f, lsMW };
      });
      const res = await updateCalculation(editRecord._id, payload);
      toast.success("Calculation updated.", {
        icon: "💾",
        style: { fontWeight: "bold" },
      });
      onSaved?.(res?.data || res || { ...editRecord, ...payload });
    } catch (err) {
      toast.error(err?.message || "Update failed", {
        style: { fontWeight: "bold" },
      });
    } finally {
      setIsSaving(false);
    }
  };

  useKeyboardShortcuts({
    onCalculateOnly: mode === "loadShed" ? handleCalculateLoadShed : handleCalculateOnly,
    onCalculateAndSave: mode === "loadShed"
      ? undefined
      : editRecord
        ? handleUpdateRecord
        : handleCalculateAndSaveHour,
    onCopy: mode === "loadShed" ? handleCopyLoadShed : handleCopyTotal,
    onHistory: goHistory,
    isSaving,
  });

  return (
    <ErrorBoundary>
      <div
        className={
          embedded
            ? "h-full w-full min-h-0 flex flex-col antialiased overflow-hidden"
            : "flex-1 flex flex-col items-center p-0 md:p-2 antialiased min-h-0 w-full"
        }
      >
        <div
          className={
            embedded
              ? "w-full h-full min-h-0 flex justify-center"
              : "w-full max-w-xl flex justify-center min-h-0"
          }
          style={
            embedded
              ? { height: "100%", maxHeight: "100%" }
              : {
                  height: "calc(100dvh - var(--shell-chrome-h, 0px))",
                  maxHeight: "calc(100dvh - var(--shell-chrome-h, 0px))",
                }
          }
        >
          <div
            data-mode={mode}
            data-nav-root
            onFocusCapture={() => {
              if (!editRecord) setHourSlot(getNearestHourSlot());
            }}
            className={
              embedded
                ? `calc-shell w-full h-full max-h-full bg-surface rounded-none shadow-none overflow-hidden flex flex-col border-0 ${
                    mode === "loadShed" ? "calc-shell--ls" : ""
                  }`
                : `calc-shell w-full h-full max-h-full bg-surface rounded-none md:rounded-xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col border-0 md:border md:border-app ${
                    mode === "loadShed" ? "calc-shell--ls md:border-amber-500/40" : ""
                  }`
            }
          >
            {/* Mobile: full station header (logo + titles). Large screen: title only. */}
            {!embedded && (
              <div className="md:hidden flex-shrink-0">
                <StationHeader />
              </div>
            )}
            <div className="hidden md:flex flex-shrink-0 bg-elevated text-white text-center border-b border-app-strong py-2.5 px-3 items-center justify-center relative">
              <h1 className="font-bold text-base tracking-tight text-slate-50 leading-tight">
                {editRecord ? "Edit Calculation" : "Load Calculator"}
              </h1>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {!embedded && <ThemeToggle compact />}
                {embedded && typeof onClose === "function" && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
            <div className={`px-2 md:px-4 py-0.5 border-b flex justify-end shrink-0 ${
              mode === "loadShed"
                ? "bg-slate-900 border-amber-700/30"
                : "bg-slate-900/80 border-slate-700/50"
            }`}>
              <OfflineBadge
                online={online}
                pendingCount={pendingCount}
                syncing={syncing}
                onSyncNow={syncPending}
              />
            </div>
            <div className="shrink-0">
              {embedded && editRecord ? (
                <div className="bg-slate-950/90 text-emerald-400 text-center font-semibold tracking-wide font-mono border-b border-app py-1.5 text-[12px] sm:text-[13px]">
                  <span className="opacity-70 mr-1.5">📅</span>
                  <span suppressHydrationWarning>
                    {(() => {
                      const iso = editRecord.calculatedAt || editRecord.createdAt;
                      if (!iso) return "—";
                      const d = new Date(iso);
                      if (Number.isNaN(d.getTime())) return "—";
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
                      const slot = editRecord.hourSlot ? ` · ${editRecord.hourSlot}` : "";
                      return `${date} · ${time}${slot}`;
                    })()}
                  </span>
                </div>
              ) : (
                <LiveClock />
              )}
            </div>
            <div className="shrink-0">
              <ModeToggle mode={mode} onChange={setMode} onHistory={goHistory} historyLabel={embedded ? "Close" : undefined} />
            </div>

            <div className="shrink-0">
              <BusVoltagePanel
                busVoltages={busVoltages}
                onChange={handleBusVoltageChange}
                handleWheel={handleWheel}
                handleKeyDown={handleKeyDown}
                mode={mode}
                allotment={allotment}
                onAllotmentChange={handleAllotmentChange}
              />
            </div>

            {mode === "loadShed" && (
              <div className="shrink-0">
                <LoadShedPanel plan={loadShedPlan} calculated={calculated} />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden">
              <FeederTable
                amps={amps}
                getDisplayMW={getDisplayMW}
                onAmpChange={handleAmpChange}
                onAmpBlur={handleAmpBlur}
                handleWheel={handleWheel}
                handleKeyDown={handleKeyDown}
                mode={mode}
                loadShedPlan={loadShedPlan}
                currentLs={currentLs}
                onCurrentLsChange={handleCurrentLsChange}
                onCurrentLsBlur={handleCurrentLsBlur}
                ringActive={ringActive}
                onRingToggle={handleRingToggle}
              />
            </div>

            <div className="flex-shrink-0 bg-surface border-t border-app pt-1">
              {mode === "normal" && (
                <ResultsPanel
                  calculate={calculated}
                  bottail11kV={totals.bottail11kV}
                  totalMW={totals.totalMW}
                  onCopy={handleCopyTotal}
                />
              )}
              <ActionBar
                mode={mode}
                onCalculateOnly={handleCalculateOnly}
                onCalculateAndSaveHour={
                  editRecord ? handleUpdateRecord : handleCalculateAndSaveHour
                }
                hourSlotLabel={
                  editRecord
                    ? editRecord.hourSlot || hourSlot?.label
                    : hourSlot?.label
                }
                hourSlotSpecial={
                  editRecord
                    ? !!(editRecord.hourSlot && String(editRecord.hourSlot).includes("30"))
                    : hourSlot?.isSpecial
                }
                onHistory={goHistory}
                historyLabel={embedded ? "Close" : undefined}
                onCalculateLoadShed={handleCalculateLoadShed}
                onCopyLoadShed={handleCopyLoadShed}
                isSaving={isSaving}
                saveLabel={editRecord ? "Update" : undefined}
              />
              <AppFooter />
            </div>
          </div>
        </div>
      </div>

      <SlotConflictModal
        open={!!slotConflict}
        slotLabel={slotConflict?.slot?.label}
        dateLabel={slotConflict?.dateLabel}
        existingTotalMW={slotConflict?.existing?.totalMW}
        existingTime={
          slotConflict?.existing?.calculatedAt
            ? new Date(slotConflict.existing.calculatedAt).toLocaleTimeString(
                "en-GB",
                { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
              )
            : null
        }
        loading={isSaving}
        onProceed={handleSlotProceed}
        onCalculateOnly={handleSlotCalculateOnly}
        onKeepPrevious={handleSlotKeepPrevious}
      />
    </ErrorBoundary>
  );
}
