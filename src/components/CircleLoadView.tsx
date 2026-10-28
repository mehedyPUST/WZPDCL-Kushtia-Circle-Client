"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchCircleSheet, saveCircleEntry } from "@/lib/api";
import { LOGSHEET_SLOTS } from "@/lib/logsheetSlots";
import { useAuth } from "@/hooks/useAuth";
import { useLiveClock } from "@/hooks/useLiveClock";
import LoginModal from "./LoginModal";
import SkeletonTable from "./SkeletonTable";

function dayKeyNow() {
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nearestSlotLabel() {
  const now = new Date();
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + OFFSET_MS);
  const h = shifted.getUTCHours();
  const mi = shifted.getUTCMinutes();
  const candidates = LOGSHEET_SLOTS.map((s) => {
    const mins = s.hour * 60 + s.minute;
    const nowM = h * 60 + mi;
    let diff = Math.abs(mins - nowM);
    if (diff > 12 * 60) diff = 24 * 60 - diff;
    return { label: s.label, diff };
  });
  candidates.sort((a, b) => a.diff - b.diff);
  return candidates[0]?.label || "00:00";
}

function fmt(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return (Math.round((Number(n) + Number.EPSILON) * 10) / 10).toFixed(1);
}

function numOr0(v) {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function shiftDay(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

const inputCls =
  "w-full min-w-0 h-8 sm:h-9 px-0.5 sm:px-1 rounded-lg border border-app bg-surface text-center font-mono text-[10px] sm:text-xs font-semibold tabular-nums text-app placeholder:text-muted transition-colors hover:border-app-strong focus:outline-none focus:ring-2 focus:ring-emerald-500/35 focus:border-emerald-500";

const readCls =
  "block w-full text-center font-mono text-[11px] sm:text-xs font-semibold tabular-nums text-secondary";

function StationTable({
  title,
  stations,
  drafts,
  setField,
  canWrite,
  mode,
  onSubmit,
  savingId,
  editable,
  isAdmin,
  totalLabel = "Circle total",
}) {
  const isPbs = mode === "pbs";

  return (
    <div className="shrink-0">
      {title ? (
        <div
          className={`px-3 py-2 border-b flex items-center gap-2 ${
            isPbs
              ? "bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-500/25"
              : "bg-elevated/90 border-app"
          }`}
        >
          <p
            className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${
              isPbs ? "text-sky-800 dark:text-sky-300" : "text-app"
            }`}
          >
            {title}
          </p>
        </div>
      ) : null}
      <div className="overflow-x-auto relative sheet-scroll-x">
        <table
          className="sheet-table w-full border-collapse text-left"
          style={{
            tableLayout: "fixed",
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: "48rem",
            width: "100%",
          }}
        >
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead className="table-header-sticky">
            <tr
              className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${
                isPbs ? "bg-sky-100 dark:bg-sky-950/90" : "bg-elevated"
              }`}
            >
              <th
                className={`time-header-sticky px-2.5 py-2.5 border-b border-r border-app font-bold text-left ${
                  isPbs ? "text-sky-800 dark:text-sky-200" : "text-app"
                }`}
              >
                Grid SS
              </th>
              <th className="px-1 py-2.5 border-b border-r border-app font-semibold text-center text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60">
                Consumption
              </th>
              <th className="px-1 py-2.5 border-b border-r border-app font-semibold text-center text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60">
                LS
              </th>
              <th className="px-1 py-2.5 border-b border-r border-app font-semibold text-center text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60">
                Demand
              </th>
              <th className="px-1 py-2.5 border-b border-r border-app font-semibold text-center text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60">
                Allotment
              </th>
              <th className="px-1 py-2.5 border-b border-app font-semibold text-center bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s, i) => {
              const d = drafts[s.id] || {};
              const isBottail = s.id === "bottail";
              const can = s.canEdit;
              const locked = !!s.editLocked;

              let consKey = "actualLoad";
              let lsKey = "loadshed";
              let allotKey = "pgcbAllotment";
              if (isPbs) {
                consKey = "pbsLoad";
                lsKey = "pbsLoadshed";
                allotKey = "pbsAllotment";
              }

              const cons = numOr0(d[consKey]);
              const ls = numOr0(d[lsKey]);
              const demand = cons + ls;

              const alt = i % 2 === 1;
              const rowBg = isBottail
                ? "bg-teal-950/30 hover:bg-teal-950/45"
                : alt
                  ? "bg-surface-2/75 hover:bg-surface-3/80"
                  : "bg-surface hover:bg-surface-3/70";

              return (
                <tr
                  key={`${mode}-${s.id}`}
                  className={`text-xs group transition-colors duration-150 ${rowBg} hover:!bg-surface-3/80`}
                >
                  <td
                    className={`time-col-sticky px-2.5 py-1.5 border-b border-r border-app align-middle ${isBottail ? "bg-teal-950/80" : ""
                      }`}
                    style={
                      isBottail
                        ? {}
                        : { backgroundColor: alt ? "var(--sticky-odd)" : "var(--sticky-even)" }
                    }
                  >
                    <div className="text-[10px] sm:text-xs font-bold text-app leading-tight truncate">
                      {s.name.replace(" (Kushtia)", "")}
                    </div>
                    <div
                      className={`mt-0.5 text-[8px] uppercase font-bold tracking-wide ${s.editLocked
                          ? "text-amber-400"
                          : isBottail
                            ? "text-teal-400"
                            : can
                              ? "text-emerald-400"
                              : "text-slate-500"
                        }`}
                    >
                      {s.editLocked
                        ? `locked ${Math.max(1, Math.ceil((s.lockRemainingSec || 0) / 60))}m`
                        : isBottail
                          ? mode === "main"
                            ? "auto"
                            : isAdmin
                              ? "admin"
                              : "auto"
                          : can
                            ? "edit"
                            : "view"}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-r border-app align-middle">
                    {can ? (
                      <input
                        className={inputCls}
                        value={d[consKey] ?? ""}
                        onChange={(e) => setField(s.id, consKey, e.target.value)}
                        inputMode="decimal"
                      />
                    ) : (
                      <span className={`${readCls} text-emerald-300`}>{fmt(d[consKey])}</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-r border-app align-middle">
                    {can ? (
                      <input
                        className={inputCls}
                        value={d[lsKey] ?? (mode === "main" ? "0" : "")}
                        onChange={(e) => setField(s.id, lsKey, e.target.value)}
                        inputMode="decimal"
                      />
                    ) : (
                      <span className={`${readCls} text-rose-300`}>
                        {fmt(d[lsKey] ?? (mode === "main" ? 0 : null))}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-r border-app align-middle bg-purple-950/20">
                    <span
                      className={`${readCls} !text-purple-300 font-bold py-1 rounded`}
                    >
                      {fmt(demand)}
                    </span>
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-r border-app align-middle">
                    {can ? (
                      <input
                        className={inputCls}
                        value={d[allotKey] ?? ""}
                        onChange={(e) => setField(s.id, allotKey, e.target.value)}
                        placeholder={fmt(demand)}
                        title="Default = demand; type to set custom"
                        inputMode="decimal"
                      />
                    ) : (
                      <span className={`${readCls} text-amber-300/90`}>
                        {d[allotKey] == null || d[allotKey] === ""
                          ? fmt(demand)
                          : fmt(d[allotKey])}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-app align-middle text-center">
                    {can ? (
                      <button
                        type="button"
                        disabled={savingId === s.id || !editable}
                        onClick={() => onSubmit(s.id)}
                        className="w-full min-h-[1.85rem] sm:min-h-[2.15rem] px-0.5 rounded-lg bg-emerald-600 text-white text-[8px] sm:text-[10px] font-extrabold uppercase tracking-wide shadow-sm shadow-emerald-950/40 transition-all hover:bg-emerald-500 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        {savingId === s.id ? "…" : "Submit"}
                      </button>
                    ) : locked ? (
                      <span className="inline-flex items-center gap-1 text-[8px] text-amber-400 font-bold uppercase">
                        <svg
                          className="w-2.5 h-2.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                          />
                        </svg>
                        Locked
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-bold">
                        {isBottail && mode === "main" ? "AUTO" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {(() => {
            let cons = 0;
            let ls = 0;
            let allot = 0;
            stations.forEach((s) => {
              const d = drafts[s.id] || {};
              const consKey = isPbs ? "pbsLoad" : "actualLoad";
              const lsKey = isPbs ? "pbsLoadshed" : "loadshed";
              const allotKey = isPbs ? "pbsAllotment" : "pgcbAllotment";
              const c = numOr0(d[consKey]);
              const l = numOr0(d[lsKey]);
              cons += c;
              ls += l;
              const demand = c + l;
              if (d[allotKey] === "" || d[allotKey] == null) allot += demand;
              else allot += numOr0(d[allotKey]);
            });
            const demand = cons + ls;
            return (
              <tfoot>
                <tr
                  className={`text-[10px] uppercase tracking-wide ${isPbs ? "bg-sky-950/90" : "bg-elevated"
                    }`}
                >
                  <td
                    className="time-col-sticky px-2.5 py-2 border-t-2 border-app-strong border-r border-app font-bold text-app"
                    style={{ backgroundColor: "var(--sticky-foot-head)" }}
                  >
                    {totalLabel}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-semibold tabular-nums text-emerald-300 border-t-2 border-app-strong border-r border-app bg-emerald-950/40">
                    {fmt(cons)}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-semibold tabular-nums text-rose-300 border-t-2 border-app-strong border-r border-app bg-rose-950/40">
                    {fmt(ls)}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-bold tabular-nums text-purple-200 border-t-2 border-app-strong border-r border-app bg-purple-950/70">
                    {fmt(demand)}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-semibold tabular-nums text-amber-300 border-t-2 border-app-strong border-r border-app bg-amber-950/40">
                    {fmt(allot)}
                  </td>
                  <td className="px-1.5 py-2 border-t-2 border-app-strong" />
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

function SubstationClockStrip() {
  const liveClock = useLiveClock();
  return (
    <div className="shrink-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-emerald-400 text-center font-semibold tracking-wide font-mono border-b border-app/80 py-2 text-[11px] sm:text-[12px] shadow-sm">
      <span className="opacity-60 mr-1.5">⏱</span>
      <span suppressHydrationWarning>{liveClock || "—"}</span>
    </div>
  );
}

export default function CircleLoadView() {
  const { isAuthenticated, canWriteCircle, isAdmin, login } = useAuth();
  const [day, setDay] = useState(dayKeyNow);
  const [slot, setSlot] = useState(nearestSlotLabel);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [needPbs, setNeedPbs] = useState(false);

  const slotIndex = useMemo(
    () => LOGSHEET_SLOTS.findIndex((s) => s.label === slot),
    [slot]
  );

  const goSlot = (dir) => {
    const i = slotIndex < 0 ? 0 : slotIndex;
    const next = i + dir;
    if (next < 0) {
      setDay((d) => shiftDay(d, -1));
      setSlot(LOGSHEET_SLOTS[LOGSHEET_SLOTS.length - 1].label);
      return;
    }
    if (next >= LOGSHEET_SLOTS.length) {
      setDay((d) => shiftDay(d, 1));
      setSlot(LOGSHEET_SLOTS[0].label);
      return;
    }
    setSlot(LOGSHEET_SLOTS[next].label);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCircleSheet({ day, slot });
      setData(res.data);
      const next = {};
      let anyPbs = false;
      (res.data?.stations || []).forEach((s) => {
        const e = s.entry || {};
        if (
          e.pbsLoad != null ||
          e.pbsAllotment != null ||
          e.pbsLoadshed != null
        ) {
          anyPbs = true;
        }
        next[s.id] = {
          actualLoad: e.actualLoad ?? "",
          pgcbAllotment: e.pgcbAllotment ?? "",
          loadshed:
            e.loadshed == null || e.loadshed === "" ? "0" : String(e.loadshed),
          pbsLoad: e.pbsLoad ?? "",
          pbsAllotment: e.pbsAllotment ?? "",
          pbsLoadshed: e.pbsLoadshed ?? "",
        };
      });
      setDrafts(next);
      if (anyPbs) setNeedPbs(true);
    } catch (err) {
      toast.error(err.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [day, slot]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const anyLock = (data?.stations || []).some((s) => s.editLocked);
    if (!anyLock) return undefined;
    const id = setInterval(() => load(), 15000);
    return () => clearInterval(id);
  }, [data?.stations, load]);

  const setField = (stationId, key, val) => {
    setDrafts((d) => ({
      ...d,
      [stationId]: { ...(d[stationId] || {}), [key]: val },
    }));
  };

  const handleSave = async (stationId) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    if (!canWriteCircle) {
      toast.error("Your role cannot save circle data");
      return;
    }
    const d = drafts[stationId] || {};
    const consumption = numOr0(d.actualLoad);
    const ls = d.loadshed === "" || d.loadshed == null ? 0 : numOr0(d.loadshed);
    const allotment =
      d.pgcbAllotment === "" || d.pgcbAllotment == null
        ? consumption + ls
        : numOr0(d.pgcbAllotment);

    const pbsCons = numOr0(d.pbsLoad);
    const pbsLs = numOr0(d.pbsLoadshed);
    const pbsDemand = pbsCons + pbsLs;
    const pbsAllotment =
      d.pbsAllotment === "" || d.pbsAllotment == null
        ? pbsDemand > 0
          ? pbsDemand
          : null
        : numOr0(d.pbsAllotment);

    setSavingId(stationId);
    try {
      await saveCircleEntry({
        dayKey: day,
        hourSlot: slot,
        stationId,
        actualLoad: d.actualLoad === "" ? null : consumption,
        loadshed: ls,
        pgcbAllotment: allotment,
        pbsLoad: d.pbsLoad === "" ? null : numOr0(d.pbsLoad),
        pbsAllotment,
        pbsLoadshed:
          d.pbsLoadshed === "" || d.pbsLoadshed == null
            ? null
            : numOr0(d.pbsLoadshed),
      });
      toast.success("Submitted");
      await load();
    } catch (err) {
      toast.error(err.message || "Submit failed");
    } finally {
      setSavingId(null);
    }
  };

  const stations = data?.stations || [];
  const isActive = !!data?.active;
  const isRelaxed = !!data?.isRelaxed;

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface-2/60 rounded-2xl border border-app overflow-hidden shadow-xl shadow-black/40">
      <SubstationClockStrip />

      <div className="flex-shrink-0 px-2.5 sm:px-4 py-2.5 sm:py-3 bg-elevated/75 border-b border-app space-y-2.5">
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-10 shrink-0 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted">
              Day
            </span>
            <div className="flex flex-1 items-center gap-1 min-w-0 rounded-lg border border-app bg-surface-2 p-0.5">
              <button
                type="button"
                onClick={() => setDay((d) => shiftDay(d, -1))}
                title="Previous day"
                aria-label="Previous day"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 inline-flex items-center justify-center rounded-md sm:rounded-lg text-secondary hover:bg-surface-3 active:scale-95 transition-all text-base sm:text-lg font-semibold"
              >
                ‹
              </button>
              <input
                id="circle-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="min-w-0 flex-1 h-8 sm:h-9 text-xs sm:text-sm font-semibold font-mono bg-transparent border-0 text-center text-app focus:outline-none focus:ring-0 px-0.5"
                aria-label="Select date"
              />
              <button
                type="button"
                onClick={() => setDay((d) => shiftDay(d, 1))}
                title="Next day"
                aria-label="Next day"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 inline-flex items-center justify-center rounded-md sm:rounded-lg text-secondary hover:bg-surface-3 active:scale-95 transition-all text-base sm:text-lg font-semibold"
              >
                ›
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="w-10 shrink-0 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted">
              Slot
            </span>
            <div
              className={`flex flex-1 items-center gap-0.5 sm:gap-1 min-w-0 rounded-lg border p-0.5 transition-all ${isActive
                  ? "border-emerald-500/60 bg-emerald-950/40 ring-1 ring-emerald-500/30"
                  : "border-app bg-surface-2"
                }`}
            >
              <button
                type="button"
                onClick={() => goSlot(-1)}
                title="Previous slot"
                aria-label="Previous slot"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 inline-flex items-center justify-center rounded-md sm:rounded-lg text-secondary hover:bg-surface-3 active:scale-95 transition-all text-base sm:text-lg font-semibold"
              >
                ‹
              </button>
              <select
                id="circle-slot"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="min-w-0 flex-1 h-8 sm:h-9 text-xs sm:text-sm font-bold font-mono bg-transparent text-center text-app border-0 focus:outline-none focus:ring-0 cursor-pointer appearance-none px-0.5"
              >
                {LOGSHEET_SLOTS.map((s) => (
                  <option key={s.label} value={s.label} className="bg-surface-2 text-app">
                    {s.label}
                    {s.isSpecial ? " ★" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => goSlot(1)}
                title="Next slot"
                aria-label="Next slot"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 inline-flex items-center justify-center rounded-md sm:rounded-lg text-secondary hover:bg-surface-3 active:scale-95 transition-all text-base sm:text-lg font-semibold"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wide border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          )}
          {isRelaxed && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-200 text-[10px] font-bold border border-amber-500/25">
              Relaxed · {data?.relaxUntil || "12:00"}
            </span>
          )}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${data?.editable
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-200 border-amber-500/25"
              }`}
          >
            {data?.editable ? "OPEN" : "CLOSED"}
          </span>
          {!isRelaxed && (
            <span className="hidden md:inline text-[10px] text-slate-500">
              Hour ±30m · 19:00 18:30–19:30 · half-slots 60m
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            <label className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 cursor-pointer select-none text-[10px] font-semibold text-secondary bg-surface-2 border border-app rounded-lg px-2.5 h-8 sm:h-9 uppercase tracking-wide hover:border-app-strong transition-colors">
              <input
                type="checkbox"
                checked={needPbs}
                onChange={(e) => setNeedPbs(e.target.checked)}
                className="rounded-md border-slate-600 accent-sky-500 focus:ring-sky-500/30"
              />
              Need PBS
            </label>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg text-[11px] sm:text-xs font-semibold bg-surface-3 border border-app text-app hover:bg-slate-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {loading ? "…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading && !data ? (
          <div className="p-4">
            <SkeletonTable rows={8} columns={6} dark />
          </div>
        ) : (
          <div className="bg-transparent">
            <StationTable
              stations={stations}
              drafts={drafts}
              setField={setField}
              mode="main"
              onSubmit={handleSave}
              savingId={savingId}
              editable={!!data?.editable}
              isAdmin={isAdmin}
              totalLabel="Circle total"
            />

            {needPbs && (
              <>
                <div className="h-2 bg-elevated border-y border-app" />
                <StationTable
                  title="PBS"
                  stations={stations}
                  drafts={drafts}
                  setField={setField}
                  mode="pbs"
                  onSubmit={handleSave}
                  savingId={savingId}
                  editable={!!data?.editable}
                  isAdmin={isAdmin}
                  totalLabel="PBS total"
                />
              </>
            )}
          </div>
        )}
      </div>

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={async (u, p) => {
          await login(u, p);
          setShowLogin(false);
          load();
        }}
      />
    </div>
  );
}