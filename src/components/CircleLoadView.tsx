"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { LayoutGrid, Table2, Lock } from "lucide-react";
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
  "w-full min-w-0 h-8 sm:h-9 px-0.5 sm:px-1 rounded-lg border border-app bg-surface text-center font-mono text-[10px] sm:text-xs font-semibold tabular-nums text-app placeholder:text-muted transition-colors hover:border-app-strong focus:outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)] focus:border-accent";

const readCls =
  "block w-full text-center font-mono text-[11px] sm:text-xs font-semibold tabular-nums text-secondary";

function StationTable({
  title,
  stations,
  drafts,
  setField,
  mode,
  onSubmit,
  savingId,
  editable,
  isAdmin,
  totalLabel = "Circle total",
}: {
  title?: string;
  stations: any[];
  drafts: Record<string, any>;
  setField: (stationId: string, key: string, val: string) => void;
  canWrite?: boolean;
  mode: string;
  onSubmit: (stationId: string) => void;
  savingId: string | null;
  editable: boolean;
  isAdmin: boolean;
  totalLabel?: string;
}) {
  const isPbs = mode === "pbs";

  return (
    <div className="shrink-0">
      {title ? (
        <div
          className={`px-3 py-2 border-b flex items-center gap-2 ${ isPbs ? "bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-500/25" : "bg-elevated/90 border-app" }`}
        >
          <p
            className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${ isPbs ? "text-sky-800 dark:text-sky-300" : "text-app" }`}
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
              className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${ isPbs ? "bg-sky-100 dark:bg-sky-950/90" : "bg-elevated" }`}
            >
              <th
                className={`time-header-sticky px-2.5 py-2.5 border-b border-r border-app font-bold text-left ${ isPbs ? "text-bus-1" : "text-app" }`}
              >
                Grid SS
              </th>
              <th className="px-1 py-2.5 border-b border-r border-app font-semibold text-center text-accent bg-emerald-100 dark:bg-emerald-950/60">
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
                ? "bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-100/70 dark:hover:bg-blue-950/50"
                : alt
                  ? "bg-surface-2/75 hover:bg-surface-3/80"
                  : "bg-surface hover:bg-surface-3/70";

              return (
                <tr
                  key={`${mode}-${s.id}`}
                  className={`text-xs group transition-colors duration-150 ${rowBg} hover:!bg-surface-3/80`}
                >
                  <td
                    className={`time-col-sticky px-2.5 py-1.5 border-b border-r border-app align-middle ${isBottail ? "bg-blue-100 dark:bg-blue-950/80" : "" }`}
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
                      className={`mt-0.5 text-[8px] uppercase font-bold tracking-wide ${s.editLocked ? "text-amber-600 dark:text-amber-400" : isBottail ? "text-blue-700 dark:text-blue-400" : can ? "text-accent" : "text-muted" }`}
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
                    {can && !(isBottail && mode === "main") ? (
                      <input
                        className={inputCls}
                        value={d[consKey] ?? ""}
                        onChange={(e) => setField(s.id, consKey, e.target.value)}
                        inputMode="decimal"
                      />
                    ) : (
                      <span
                        className={`${readCls} text-accent`}
                        title={isBottail && mode === "main" ? "From Bottail calculator" : undefined}
                      >
                        {fmt(d[consKey])}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-r border-app align-middle">
                    {can ? (
                      <input
                        className={inputCls}
                        value={d[lsKey] ?? (mode === "main" ? "0" : "")}
                        onChange={(e) => setField(s.id, lsKey, e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        title="Loadshed (manual)"
                      />
                    ) : (
                      <span className={`${readCls} text-rose-700 dark:text-rose-300`}>
                        {fmt(d[lsKey] ?? (mode === "main" ? 0 : null))}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-r border-app align-middle bg-purple-50/50 dark:bg-purple-950/20">
                    <span
                      className={`${readCls} text-purple-800 dark:text-purple-300 font-bold py-1 rounded`}
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
                      <span className={`${readCls} text-amber-800 dark:text-amber-300/90`}>
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
                        className="w-full min-h-[1.85rem] sm:min-h-[2.15rem] px-0.5 rounded-lg btn-primary text-[8px] sm:text-[10px] font-extrabold uppercase tracking-wide shadow-sm shadow-emerald-950/40 transition-all hover:opacity-95 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        {savingId === s.id ? "…" : "Submit"}
                      </button>
                    ) : locked ? (
                      <span className="inline-flex items-center gap-1 text-[8px] text-amber-700 dark:text-amber-400 font-bold uppercase">
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
                      <span className="text-[9px] text-muted font-bold">
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
                  className={`text-[10px] uppercase tracking-wide ${isPbs ? "bg-sky-100 dark:bg-sky-950/85" : "bg-elevated" }`}
                >
                  <td
                    className="time-col-sticky px-2.5 py-2 border-t-2 border-app-strong border-r border-app font-bold text-app"
                    style={{ backgroundColor: "var(--sticky-foot-head)" }}
                  >
                    {totalLabel}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-semibold tabular-nums text-accent border-t-2 border-app-strong border-r border-app bg-emerald-50 dark:bg-emerald-950/40">
                    {fmt(cons)}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-semibold tabular-nums text-rose-700 dark:text-rose-300 border-t-2 border-app-strong border-r border-app bg-rose-50 dark:bg-rose-950/40">
                    {fmt(ls)}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-bold tabular-nums text-app border-t-2 border-app-strong border-r border-app bg-[var(--app-violet-dim)]">
                    {fmt(demand)}
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono font-semibold tabular-nums text-amber-800 dark:text-amber-300 border-t-2 border-app-strong border-r border-app bg-amber-50 dark:bg-amber-950/40">
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

function StationCards({
  title,
  stations,
  drafts,
  setField,
  mode,
  onSubmit,
  savingId,
  editable,
  isAdmin,
  totalLabel = "Circle total",
}: {
  title?: string;
  stations: any[];
  drafts: Record<string, any>;
  setField: (stationId: string, key: string, val: string) => void;
  mode: string;
  onSubmit: (stationId: string) => void;
  savingId: string | null;
  editable: boolean;
  isAdmin: boolean;
  totalLabel?: string;
}) {
  const isPbs = mode === "pbs";
  const consKey = isPbs ? "pbsLoad" : "actualLoad";
  const lsKey = isPbs ? "pbsLoadshed" : "loadshed";
  const allotKey = isPbs ? "pbsAllotment" : "pgcbAllotment";

  let totalCons = 0;
  let totalLs = 0;
  let totalAllot = 0;
  stations.forEach((s) => {
    const d = drafts[s.id] || {};
    const c = numOr0(d[consKey]);
    const l = numOr0(d[lsKey]);
    totalCons += c;
    totalLs += l;
    const dem = c + l;
    if (d[allotKey] === "" || d[allotKey] == null) totalAllot += dem;
    else totalAllot += numOr0(d[allotKey]);
  });
  const totalDemand = totalCons + totalLs;

  return (
    <div className="p-2.5 sm:p-3 space-y-2.5">
      {title ? (
        <div
          className={`px-3 py-2 rounded-xl border flex items-center justify-between ${
            isPbs
              ? "bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-500/25"
              : "bg-elevated border-app"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {stations.map((s) => {
          const d = drafts[s.id] || {};
          const isBottail = s.id === "bottail";
          const can = s.canEdit;
          const locked = !!s.editLocked;

          const cons = numOr0(d[consKey]);
          const ls = numOr0(d[lsKey]);
          const demand = cons + ls;

          const cardTone = isBottail
            ? "from-blue-50/90 via-white to-blue-50/40 border-blue-200 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25"
            : locked
              ? "from-orange-50/90 via-white to-orange-50/40 border-orange-200 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25"
              : can
                ? "from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25"
                : "from-purple-50/80 via-white to-purple-50/30 border-purple-200 dark:from-purple-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-purple-500/25";

          return (
            <div
              key={`${mode}-card-${s.id}`}
              className={`rounded-xl border bg-gradient-to-br p-3 shadow-sm space-y-2.5 ${cardTone}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-app leading-tight truncate">
                    {s.name.replace(" (Kushtia)", "")}
                  </div>
                  <div
                    className={`mt-0.5 text-[10px] uppercase font-bold tracking-wider ${
                      s.editLocked
                        ? "text-amber-600 dark:text-amber-400"
                        : isBottail
                          ? "text-blue-700 dark:text-blue-400"
                          : can
                            ? "text-accent"
                            : "text-muted"
                    }`}
                  >
                    {s.editLocked
                      ? `Locked ${Math.max(1, Math.ceil((s.lockRemainingSec || 0) / 60))}m`
                      : isBottail
                        ? mode === "main"
                          ? "Auto from calculator"
                          : isAdmin
                            ? "Admin edit"
                            : "Auto"
                        : can
                          ? "Editable"
                          : "View only"}
                  </div>
                </div>

                <div className="shrink-0 text-right px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                    Demand
                  </div>
                  <div className="text-sm font-mono font-extrabold tabular-nums text-purple-800 dark:text-purple-200">
                    {fmt(demand)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-accent text-center">
                    Cons.
                  </label>
                  {can && !(isBottail && mode === "main") ? (
                    <input
                      className="w-full h-11 px-1.5 rounded-lg border border-app bg-surface-2 text-center font-mono text-sm font-bold tabular-nums text-app focus:outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)] focus:border-accent"
                      value={d[consKey] ?? ""}
                      onChange={(e) => setField(s.id, consKey, e.target.value)}
                      inputMode="decimal"
                      aria-label={`${s.name} consumption`}
                    />
                  ) : (
                    <div
                      className="h-11 rounded-lg bg-surface-2/60 border border-app/60 flex items-center justify-center font-mono text-sm font-bold tabular-nums text-accent"
                      title={isBottail && mode === "main" ? "From Bottail calculator" : undefined}
                    >
                      {fmt(d[consKey])}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 text-center">
                    LS
                  </label>
                  {can ? (
                    <input
                      className="w-full h-11 px-1.5 rounded-lg border border-app bg-surface-2 text-center font-mono text-sm font-bold tabular-nums text-app focus:outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)] focus:border-accent"
                      value={d[lsKey] ?? (mode === "main" ? "0" : "")}
                      onChange={(e) => setField(s.id, lsKey, e.target.value)}
                      inputMode="decimal"
                      aria-label={`${s.name} loadshed`}
                    />
                  ) : (
                    <div className="h-11 rounded-lg bg-surface-2/60 border border-app/60 flex items-center justify-center font-mono text-sm font-bold tabular-nums text-rose-700 dark:text-rose-300">
                      {fmt(d[lsKey] ?? (mode === "main" ? 0 : null))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 text-center">
                    Allot.
                  </label>
                  {can ? (
                    <input
                      className="w-full h-11 px-1.5 rounded-lg border border-app bg-surface-2 text-center font-mono text-sm font-bold tabular-nums text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)] focus:border-accent"
                      value={d[allotKey] ?? ""}
                      onChange={(e) => setField(s.id, allotKey, e.target.value)}
                      placeholder={fmt(demand)}
                      inputMode="decimal"
                      aria-label={`${s.name} allotment`}
                    />
                  ) : (
                    <div className="h-11 rounded-lg bg-surface-2/60 border border-app/60 flex items-center justify-center font-mono text-sm font-bold tabular-nums text-amber-800 dark:text-amber-300">
                      {d[allotKey] == null || d[allotKey] === ""
                        ? fmt(demand)
                        : fmt(d[allotKey])}
                    </div>
                  )}
                </div>
              </div>

              {can ? (
                <button
                  type="button"
                  disabled={savingId === s.id || !editable}
                  onClick={() => onSubmit(s.id)}
                  className="w-full h-11 rounded-xl btn-primary text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingId === s.id ? "Submitting…" : "Submit"}
                </button>
              ) : locked ? (
                <div className="h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        className={`rounded-xl border bg-gradient-to-br p-3 shadow-sm ${
          isPbs
            ? "from-blue-50/90 via-white to-blue-50/40 border-blue-200 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25"
            : "from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200 dark:from-emerald-950/55 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-emerald-500/25"
        }`}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-app mb-2">
          {totalLabel}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center font-mono tabular-nums">
          <div className="rounded-lg bg-surface p-1.5 border border-app">
            <div className="text-[9px] font-sans font-bold uppercase text-muted">Cons</div>
            <div className="text-xs font-extrabold text-accent">{fmt(totalCons)}</div>
          </div>
          <div className="rounded-lg bg-surface p-1.5 border border-app">
            <div className="text-[9px] font-sans font-bold uppercase text-muted">LS</div>
            <div className="text-xs font-extrabold text-rose-700 dark:text-rose-300">{fmt(totalLs)}</div>
          </div>
          <div className="rounded-lg bg-surface p-1.5 border border-app">
            <div className="text-[9px] font-sans font-bold uppercase text-muted">Demand</div>
            <div className="text-xs font-extrabold text-app">{fmt(totalDemand)}</div>
          </div>
          <div className="rounded-lg bg-surface p-1.5 border border-app">
            <div className="text-[9px] font-sans font-bold uppercase text-muted">Allot</div>
            <div className="text-xs font-extrabold text-amber-800 dark:text-amber-300">{fmt(totalAllot)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubstationClockStrip() {
  const liveClock = useLiveClock();
  return (
    <div className="shrink-0 bg-surface-2 text-accent text-center font-semibold tracking-wide font-mono border-b border-app/80 py-2 text-[11px] sm:text-[12px] shadow-sm">
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
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setViewMode("cards");
    }
  }, []);

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
    // Demand = consumption + LS. Allotment optional → defaults to demand.
    const consumption = numOr0(d.actualLoad);
    const ls = d.loadshed === "" || d.loadshed == null ? 0 : numOr0(d.loadshed);
    const demand = consumption + ls;
    const allotment =
      d.pgcbAllotment === "" || d.pgcbAllotment == null
        ? demand
        : numOr0(d.pgcbAllotment);

    const pbsCons = numOr0(d.pbsLoad);
    const pbsLs =
      d.pbsLoadshed === "" || d.pbsLoadshed == null ? 0 : numOr0(d.pbsLoadshed);
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
        // Bottail: backend keeps calculator consumption for non-admin; still send current value.
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
    <div className="h-full flex flex-col min-h-0 rounded-2xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 overflow-hidden shadow-sm">
      <SubstationClockStrip />

      <div className="flex-shrink-0 px-2.5 sm:px-4 py-2.5 sm:py-3 bg-emerald-50/60 dark:bg-teal-950/35 border-b border-emerald-200/80 dark:border-teal-500/20 space-y-2.5">
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
              className={`flex flex-1 items-center gap-0.5 sm:gap-1 min-w-0 rounded-lg border p-0.5 transition-all ${isActive ? "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-500/30" : "border-app bg-surface-2" }`}
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-600/20 text-accent text-[10px] font-bold uppercase tracking-wide border border-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              Active
            </span>
          )}
          {isRelaxed && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 text-[10px] font-bold border border-amber-300 dark:border-amber-500/25">
              Relaxed · {data?.relaxUntil || "12:00"}
            </span>
          )}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${data?.editable ? "bg-emerald-50 dark:bg-emerald-500/15 text-accent border-accent" : "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-500/25" }`}
          >
            {data?.editable ? "OPEN" : "CLOSED"}
          </span>
          {!isRelaxed && (
            <span className="hidden md:inline text-[10px] text-muted">
              Hour ±30m · 19:00 18:30–19:30 · half-slots 60m
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div
              className="inline-flex rounded-lg border border-app bg-surface-2 p-0.5 h-8 sm:h-9 shrink-0"
              role="group"
              aria-label="Layout mode"
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`inline-flex items-center gap-1 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  viewMode === "cards"
                    ? "btn-primary shadow-xs"
                    : "text-muted hover:text-app"
                }`}
                aria-pressed={viewMode === "cards"}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  viewMode === "table"
                    ? "btn-primary shadow-xs"
                    : "text-muted hover:text-app"
                }`}
                aria-pressed={viewMode === "table"}
              >
                <Table2 className="w-3 h-3" />
                <span>Table</span>
              </button>
            </div>
            <label className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 cursor-pointer select-none text-[10px] font-semibold text-secondary bg-surface-2 border border-app rounded-lg px-2.5 h-8 sm:h-9 uppercase tracking-wide hover:border-app-strong transition-colors">
              <input
                type="checkbox"
                checked={needPbs}
                onChange={(e) => setNeedPbs(e.target.checked)}
                className="rounded-md border-app accent-sky-500 focus:ring-sky-500/30"
              />
              Need PBS
            </label>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg text-[11px] sm:text-xs font-semibold bg-surface-3 border border-app text-app hover:bg-surface-3 disabled:opacity-50 transition-colors shrink-0"
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
        ) : viewMode === "cards" ? (
          <div className="bg-transparent">
            <StationCards
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
                <StationCards
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