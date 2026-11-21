"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Pencil,
  RefreshCw,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchAllOvertimeSheets } from "@/lib/overtimeApi";
import {
  MONTH_LABELS,
  currentDhakaYearMonth,
  generateOvertimeRows,
  totalOvertimeHours,
  MAX_OVERTIME_HOURS,
  type OvertimeSheetRecord,
} from "@/lib/overtime";
import OvertimeDataPanel from "./OvertimeDataPanel";

type TeamItem = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  assignedStation: string;
  hasSheet: boolean;
  sheet: Partial<OvertimeSheetRecord> & {
    year?: number;
    month?: number;
    employeeName?: string;
    designation?: string;
    weeklyHoliday?: number;
    clLeaveDates?: string[];
    excludedDates?: string[];
    extraDutyEntries?: any[];
    dutyShift?: string;
    purpose?: string;
  };
  updatedAt: string | null;
};

function hoursForSheet(sheet: TeamItem["sheet"], year: number, month: number): number {
  try {
    const rows = generateOvertimeRows({
      year,
      month,
      weeklyHoliday: Number(sheet.weeklyHoliday ?? 0),
      clLeaveDates: Array.isArray(sheet.clLeaveDates) ? sheet.clLeaveDates : [],
      excludedDates: Array.isArray(sheet.excludedDates) ? sheet.excludedDates : [],
      extraDutyEntries: Array.isArray(sheet.extraDutyEntries)
        ? sheet.extraDutyEntries
        : [],
      dutyShift: (sheet.dutyShift as any) || "C",
      purpose: sheet.purpose || "",
    });
    return totalOvertimeHours(rows);
  } catch {
    return 0;
  }
}

function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

export default function AllOvertimePanel() {
  const init = currentDhakaYearMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [items, setItems] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionUser, setActionUser] = useState<TeamItem | null>(null);
  const [actionMode, setActionMode] = useState<"preview" | "modify">("preview");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const data = await fetchAllOvertimeSheets({ year, month });
        setItems((data.items || []) as TeamItem[]);
      } catch (err: any) {
        const msg = err?.message || "Failed to load team overtime sheets";
        setError(msg);
        if (!silent) toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [year, month]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const yearOptions = useMemo(() => {
    const y = init.year;
    return [y - 1, y, y + 1];
  }, [init.year]);

  const summary = useMemo(() => {
    let withSheet = 0;
    let totalHours = 0;
    let overCap = 0;
    for (const it of items) {
      if (it.hasSheet) withSheet += 1;
      const h = hoursForSheet(it.sheet, year, month);
      totalHours += h;
      if (h > MAX_OVERTIME_HOURS) overCap += 1;
    }
    return { withSheet, totalHours, overCap, total: items.length };
  }, [items, year, month]);

  const openAction = (item: TeamItem, mode: "preview" | "modify") => {
    setActionUser(item);
    setActionMode(mode);
  };

  const closeAction = () => {
    setActionUser(null);
  };

  if (actionUser) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 px-4 sm:px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-700 dark:bg-teal-950/70 dark:border-teal-500/35 dark:text-teal-300 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold text-zinc-800 dark:text-white truncate font-display">
                {actionUser.displayName || actionUser.username}
                <span className="ml-2 text-xs font-mono font-normal text-zinc-500 dark:text-slate-400">
                  @{actionUser.username}
                </span>
              </p>
              <p className="text-xs text-zinc-600 dark:text-slate-300">
                {MONTH_LABELS[month - 1]} {year} ·{" "}
                <span className="font-semibold text-emerald-700 dark:text-teal-300">
                  {actionMode === "modify" ? "Edit mode" : "Preview mode"}
                </span>
                {actionUser.assignedStation
                  ? ` · ${actionUser.assignedStation}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAction}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 dark:border-teal-500/25 bg-white/85 dark:bg-[#0f1726]/75 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-teal-200 hover:bg-emerald-50 dark:hover:bg-teal-950/60 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to team list
          </button>
        </div>

        <OvertimeDataPanel
          key={`${actionUser.userId}-${year}-${month}-${actionMode}`}
          displayName={actionUser.displayName || actionUser.username}
          username={actionUser.username}
          targetUserId={actionUser.userId}
          targetDisplayName={actionUser.displayName || actionUser.username}
          initialYear={year}
          initialMonth={month}
          initialModalMode={actionMode}
          onSaved={() => void load(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Instructional Header Banner */}
      <header className="rounded-xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-700 dark:bg-teal-950/70 dark:border-teal-500/35 dark:text-teal-300 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-white tracking-tight font-display">
                Overtime Sheets
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                Select a billing month to inspect every duty operator&apos;s SBA overtime sheet, verify the {MAX_OVERTIME_HOURS}h monthly limit, and preview or update entries.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-slate-300">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700 dark:text-teal-300 shrink-0" />
              <span className="sr-only">Month</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-emerald-200/80 dark:border-teal-500/25 bg-white/90 dark:bg-[#0f1726]/85 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-teal-400/30"
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center">
              <span className="sr-only">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-emerald-200/80 dark:border-teal-500/25 bg-white/90 dark:bg-[#0f1726]/85 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-teal-400/30"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 dark:border-teal-500/25 bg-white/85 dark:bg-[#0f1726]/75 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-teal-200 hover:bg-emerald-50 dark:hover:bg-teal-950/60 disabled:opacity-60 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* 4-Column Summary KPI Strip */}
      <section
        aria-label="Team overtime summary"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="rounded-xl border bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border-blue-200 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-blue-700 dark:text-sky-300">
              Duty Persons
            </p>
            <span className="w-7 h-7 rounded-lg bg-blue-100/80 border border-blue-200 text-blue-600 dark:bg-sky-500/15 dark:border-sky-400/30 dark:text-sky-300 inline-flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-zinc-800 dark:text-white font-mono tabular-nums tracking-tight">
            {summary.total}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
            Active duty SBA accounts
          </p>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200 dark:from-emerald-950/55 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-emerald-500/25 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Sheets Saved
            </p>
            <span className="w-7 h-7 rounded-lg bg-emerald-100/80 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-emerald-300 inline-flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
            {summary.withSheet}
            <span className="text-base font-semibold text-zinc-500 dark:text-slate-400">
              {" "}
              / {summary.total}
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
            {MONTH_LABELS[month - 1]} {year} submissions
          </p>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 border-purple-200 dark:from-purple-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-purple-500/25 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Combined OT Hours
            </p>
            <span className="w-7 h-7 rounded-lg bg-purple-100/80 border border-purple-200 text-purple-600 dark:bg-purple-500/15 dark:border-purple-400/30 dark:text-purple-300 inline-flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300 font-mono tabular-nums tracking-tight">
            {summary.totalHours}h
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
            Cumulative monthly claim
          </p>
        </div>

        <div
          className={`rounded-xl border bg-gradient-to-br p-4 shadow-sm ${
            summary.overCap > 0
              ? "from-rose-50/90 via-white to-rose-50/40 border-rose-200 dark:from-rose-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-rose-500/25"
              : "from-orange-50/90 via-white to-orange-50/40 border-orange-200 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-xs font-semibold ${
                summary.overCap > 0
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-orange-700 dark:text-amber-300"
              }`}
            >
              Over {MAX_OVERTIME_HOURS}h Limit
            </p>
            <span
              className={`w-7 h-7 rounded-lg border inline-flex items-center justify-center shrink-0 ${
                summary.overCap > 0
                  ? "bg-rose-100/80 border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-400/30 dark:text-rose-300"
                  : "bg-orange-100/80 border-orange-200 text-orange-600 dark:bg-amber-500/15 dark:border-amber-400/30 dark:text-amber-300"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <p
            className={`mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${
              summary.overCap > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-800 dark:text-white"
            }`}
          >
            {summary.overCap}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
            {summary.overCap > 0 ? "Requires hour adjustment" : "All sheets within limit"}
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-100 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-semibold underline shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Team Overtime Ledger Table */}
      <section className="rounded-xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-emerald-200/80 dark:border-teal-500/20 bg-emerald-50/60 dark:bg-teal-950/35 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-emerald-800 dark:text-teal-200 font-display">
              Duty SBA Roster · {MONTH_LABELS[month - 1]} {year}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-slate-400 mt-0.5">
              Use <strong className="font-semibold text-zinc-800 dark:text-slate-200">View</strong> for print/PDF preview or <strong className="font-semibold text-zinc-800 dark:text-slate-200">Edit</strong> to update and save on an operator&apos;s behalf.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-teal-300 font-semibold">
            Cap: {MAX_OVERTIME_HOURS}h / month
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-50/80 dark:bg-teal-950/45 text-left text-[11px] uppercase tracking-wider text-zinc-600 dark:text-slate-300 border-b border-emerald-200/80 dark:border-teal-500/20">
                <th className="px-4 py-3 font-semibold">Duty Person</th>
                <th className="px-4 py-3 font-semibold">Station</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">OT Hours</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Last Updated</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-200/60 dark:divide-teal-500/15">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-zinc-500 dark:text-slate-400 text-xs"
                  >
                    Loading team overtime sheets…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-zinc-500 dark:text-slate-400 text-xs"
                  >
                    No duty persons found.
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const hours = hoursForSheet(it.sheet, year, month);
                  const over = hours > MAX_OVERTIME_HOURS;
                  return (
                    <tr
                      key={it.userId}
                      className="odd:bg-white/75 even:bg-emerald-50/35 dark:odd:bg-[#0f1726]/40 dark:even:bg-teal-950/20 hover:bg-emerald-100/40 dark:hover:bg-teal-900/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-800 dark:text-white">
                          {it.displayName || it.username}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                          @{it.username}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-slate-300">
                        {it.assignedStation || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">
                        {it.hasSheet ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Saved
                          </span>
                        ) : (
                          <span className="text-zinc-500 dark:text-slate-400 whitespace-nowrap">
                            Not started
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-bold font-mono tabular-nums ${
                            over
                              ? "text-rose-600 dark:text-rose-400"
                              : hours > 0
                                ? "text-blue-700 dark:text-sky-300"
                                : "text-zinc-400 dark:text-slate-500"
                          }`}
                        >
                          {hours}h
                        </span>
                        {over && (
                          <span className="ml-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                            · Over {MAX_OVERTIME_HOURS}h
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-zinc-700 dark:text-slate-200">
                        {it.sheet?.designation || "SBA-A"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono tabular-nums text-zinc-500 dark:text-slate-400 whitespace-nowrap">
                        {formatUpdated(it.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAction(it, "preview")}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/80 dark:border-teal-500/30 bg-white/90 dark:bg-[#0f1726]/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-teal-950/60 transition whitespace-nowrap cursor-pointer"
                            title="View / print sheet"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction(it, "modify")}
                            className="btn-primary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-xs transition whitespace-nowrap cursor-pointer"
                            title="Edit this person's overtime"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
