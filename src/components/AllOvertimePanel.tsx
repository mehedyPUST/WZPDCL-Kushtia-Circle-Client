"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Eye,
  FileText,
  Pencil,
  RefreshCw,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchAllOvertimeSheets } from "@/lib/api";
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

  // When viewing another user, show their OvertimeDataPanel full-screen style in a section
  if (actionUser) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                {actionUser.displayName || actionUser.username}
                <span className="ml-2 text-[11px] font-normal text-slate-500">
                  @{actionUser.username}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {MONTH_LABELS[month - 1]}-{year} ·{" "}
                {actionMode === "modify" ? "Edit mode" : "Preview mode"}
                {actionUser.assignedStation
                  ? ` · ${actionUser.assignedStation}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAction}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            ← Back to team list
          </button>
        </div>

        <OvertimeDataPanel
          key={`${actionUser.userId}-${year}-${month}`}
          displayName={actionUser.displayName || actionUser.username}
          username={actionUser.username}
          targetUserId={actionUser.userId}
          targetDisplayName={actionUser.displayName || actionUser.username}
          initialYear={year}
          initialMonth={month}
          onSaved={() => void load(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                All Duty SBA Overtime Sheets
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                View and take action on every duty person&apos;s overtime for the
                selected month
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-900/40">
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Duty persons
            </p>
            <p className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
              {summary.total}
            </p>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Sheets saved
            </p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.withSheet}
            </p>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Combined OT hours
            </p>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {summary.totalHours}h
            </p>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Over {MAX_OVERTIME_HOURS}h limit
            </p>
            <p
              className={`text-lg font-bold tabular-nums ${
                summary.overCap > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {summary.overCap}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-100">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 font-semibold">Duty person</th>
                <th className="px-4 py-3 font-semibold">Station</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">OT hours</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Last updated</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400 text-xs"
                  >
                    Loading team overtime sheets…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400 text-xs"
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
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {it.displayName || it.username}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          @{it.username}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {it.assignedStation || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {it.hasSheet ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Saved
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Not started
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            over
                              ? "text-rose-600 dark:text-rose-400"
                              : hours > 0
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-slate-400"
                          }`}
                        >
                          {hours}h
                        </span>
                        {over && (
                          <span className="ml-1.5 text-[10px] text-rose-500 font-medium">
                            over limit
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {it.sheet?.designation || "SBA-A"}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatUpdated(it.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAction(it, "preview")}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                            title="View / print sheet"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction(it, "modify")}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition"
                            title="Edit this person's overtime"
                          >
                            <Pencil className="h-3 w-3" />
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
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
        All duty SBA users can view and edit each other&apos;s overtime sheets.
        Use <strong>View</strong> to open the official form (print/PDF) or{" "}
        <strong>Edit</strong> to modify and save on their behalf.
      </p>
    </div>
  );
}
