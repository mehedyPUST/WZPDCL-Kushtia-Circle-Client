"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchOvertimeSheet, saveOvertimeSheet } from "@/lib/api";
import {
  WEEKDAY_LABELS,
  WEEKDAY_LABELS_BN,
  MONTH_LABELS,
  DUTY_SHIFTS,
  currentDhakaYearMonth,
  dutyDurationHours,
  emptyExtraEntry,
  formatDurationBn,
  formatYmdDisplayBn,
  generateOvertimeRows,
  normalizeDutyShift,
  totalOvertimeHours,
  toBengaliDigits,
  type DutyShiftId,
  type ExtraDutyEntry,
  type OvertimeRow,
  type OvertimeSheetRecord,
} from "@/lib/overtime";

interface OvertimeDataPanelProps {
  displayName?: string;
  username?: string;
}

type PanelMode = "view" | "edit" | "preview";

export default function OvertimeDataPanel({
  displayName = "",
  username = "",
}: OvertimeDataPanelProps) {
  const init = currentDhakaYearMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [employeeName, setEmployeeName] = useState(displayName || "");
  const [designation, setDesignation] = useState("SBA-A");
  const [weeklyHoliday, setWeeklyHoliday] = useState(0);
  const [clLeaveDates, setClLeaveDates] = useState<string[]>([]);
  const [extraDutyEntries, setExtraDutyEntries] = useState<ExtraDutyEntry[]>([]);
  const [clInput, setClInput] = useState("");
  const [dutyShift, setDutyShift] = useState<DutyShiftId>("C");
  const [purpose, setPurpose] = useState(
    "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<PanelMode>("view");
  const [dirty, setDirty] = useState(false);

  // Draft for adding a new extra day
  const [extraDraft, setExtraDraft] = useState<ExtraDutyEntry>(emptyExtraEntry());

  const applySheet = useCallback(
    (sheet: Partial<OvertimeSheetRecord>) => {
      setEmployeeName(sheet.employeeName || displayName || "");
      setDesignation(sheet.designation || "SBA-A");
      setWeeklyHoliday(
        typeof sheet.weeklyHoliday === "number" ? sheet.weeklyHoliday : 0
      );
      setClLeaveDates(
        Array.isArray(sheet.clLeaveDates) ? sheet.clLeaveDates : []
      );
      setExtraDutyEntries(
        Array.isArray(sheet.extraDutyEntries) ? sheet.extraDutyEntries : []
      );
      setDutyShift(normalizeDutyShift(sheet.dutyShift ?? "C"));
      setPurpose(
        sheet.purpose || "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
      );
      setDirty(false);
    },
    [displayName]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOvertimeSheet({ year, month });
      applySheet((data.sheet || {}) as OvertimeSheetRecord);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load overtime data");
    } finally {
      setLoading(false);
    }
  }, [year, month, applySheet]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: OvertimeRow[] = useMemo(
    () =>
      generateOvertimeRows({
        year,
        month,
        weeklyHoliday,
        clLeaveDates,
        extraDutyEntries,
        dutyShift,
        purpose,
      }),
    [year, month, weeklyHoliday, clLeaveDates, extraDutyEntries, dutyShift, purpose]
  );

  const totalHours = useMemo(() => totalOvertimeHours(rows), [rows]);
  const shiftMeta = DUTY_SHIFTS[dutyShift];
  const markDirty = () => setDirty(true);

  const addClDate = () => {
    const v = clInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      toast.error("Pick a valid CL leave date");
      return;
    }
    if (clLeaveDates.includes(v)) {
      toast.error("Date already listed");
      return;
    }
    setClLeaveDates((prev) => [...prev, v].sort());
    setClInput("");
    markDirty();
  };

  const removeClDate = (ymd: string) => {
    setClLeaveDates((prev) => prev.filter((d) => d !== ymd));
    markDirty();
  };

  const addExtraEntry = () => {
    const date = extraDraft.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Pick a valid extra duty date");
      return;
    }
    const m = date.match(/^(\d{4})-(\d{2})-/);
    if (!m || Number(m[1]) !== year || Number(m[2]) !== month) {
      toast.error("Extra day must be inside the selected month");
      return;
    }
    if (clLeaveDates.includes(date)) {
      toast.error("This date is marked as CL leave");
      return;
    }
    if (extraDutyEntries.some((e) => e.date === date)) {
      toast.error("Extra day already added");
      return;
    }
    if (!extraDraft.dutyFrom || !extraDraft.dutyTo) {
      toast.error("Duty time (from / to) is required");
      return;
    }
    setExtraDutyEntries((prev) =>
      [...prev, { ...extraDraft, date }].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    );
    setExtraDraft(emptyExtraEntry());
    markDirty();
  };

  const updateExtraEntry = (date: string, patch: Partial<ExtraDutyEntry>) => {
    setExtraDutyEntries((prev) =>
      prev.map((e) => (e.date === date ? { ...e, ...patch } : e))
    );
    markDirty();
  };

  const removeExtraEntry = (date: string) => {
    setExtraDutyEntries((prev) => prev.filter((e) => e.date !== date));
    markDirty();
  };

  const buildPayload = () => ({
    year,
    month,
    employeeName: employeeName.trim(),
    designation: designation.trim() || "SBA-A",
    weeklyHoliday,
    clLeaveDates,
    extraDutyEntries,
    dutyShift,
    purpose,
  });

  const handleSave = async () => {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return false;
    }
    setSaving(true);
    try {
      await saveOvertimeSheet(buildPayload());
      setDirty(false);
      toast.success("Overtime data saved to backend");
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const yearOptions = useMemo(() => {
    const y = init.year;
    return [y - 1, y, y + 1];
  }, [init.year]);

  if (mode === "preview") {
    return (
      <OvertimePreviewPage
        year={year}
        month={month}
        employeeName={employeeName}
        designation={designation}
        rows={rows}
        totalHours={totalHours}
        saving={saving}
        onSave={async () => handleSave()}
        onDownload={() => window.print()}
        onModify={() => setMode("edit")}
        onClose={() => setMode("view")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/30 border-amber-200/80 dark:from-amber-950/40 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25 overflow-hidden shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-amber-200/70 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-zinc-800 dark:text-white">
                Overtime Data
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400 truncate">
                Saved on backend under your user id
                {username ? ` (${username})` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setMode("view");
              }}
              className="text-xs rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 font-medium"
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setMode("view");
              }}
              className="text-xs rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 font-medium"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-500 dark:text-slate-400">
            Loading overtime settings…
          </div>
        ) : mode === "edit" ? (
          <div className="p-4 sm:p-5 space-y-4">
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
              Modify mode — changes are stored on the <strong>backend</strong> when
              you click Save.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                  Name of Employee
                </span>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => {
                    setEmployeeName(e.target.value);
                    markDirty();
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                  Designation
                </span>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => {
                    setDesignation(e.target.value);
                    markDirty();
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                  Weekly Holiday
                </span>
                <select
                  value={weeklyHoliday}
                  onChange={(e) => {
                    setWeeklyHoliday(Number(e.target.value));
                    markDirty();
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {WEEKDAY_LABELS.map((label, i) => (
                    <option key={label} value={i}>
                      {label} ({WEEKDAY_LABELS_BN[i]})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                  Duty shift on weekly holiday
                </span>
                <select
                  value={dutyShift}
                  onChange={(e) => {
                    setDutyShift(normalizeDutyShift(e.target.value));
                    markDirty();
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {(Object.keys(DUTY_SHIFTS) as DutyShiftId[]).map((id) => {
                    const s = DUTY_SHIFTS[id];
                    return (
                      <option key={id} value={id}>
                        {s.label} — {s.fromDisplay} to {s.toDisplay} ({s.hours}h)
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                Default purpose (weekly holiday rows)
              </span>
              <input
                type="text"
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  markDirty();
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bangla"
              />
            </label>

            {/* CL leave */}
            <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-900/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-slate-200">
                  CL leave taken days (excluded)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={clInput}
                  onChange={(e) => setClInput(e.target.value)}
                  className="rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={addClDate}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-800 dark:bg-slate-100 text-white dark:text-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {clLeaveDates.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {clLeaveDates.map((d) => (
                    <li
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 px-2.5 py-0.5 text-[11px] font-mono text-rose-800 dark:text-rose-200"
                    >
                      {d}
                      <button type="button" onClick={() => removeClDate(d)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Extra duty days with full time + purpose */}
            <div className="rounded-lg border border-sky-200 dark:border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-slate-200">
                  Extra duty days (not normal weekly holiday)
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400">
                For each extra day set normal duty time, overtime (duty) time, and
                purpose.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <label className="block text-[11px]">
                  <span className="font-semibold text-zinc-600 dark:text-slate-300">
                    Date
                  </span>
                  <input
                    type="date"
                    value={extraDraft.date}
                    onChange={(e) =>
                      setExtraDraft((d) => ({ ...d, date: e.target.value }))
                    }
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono"
                  />
                </label>
                <label className="block text-[11px]">
                  <span className="font-semibold text-zinc-600 dark:text-slate-300">
                    Normal duty From
                  </span>
                  <input
                    type="time"
                    value={extraDraft.normalFrom}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        normalFrom: e.target.value,
                      }))
                    }
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono"
                  />
                </label>
                <label className="block text-[11px]">
                  <span className="font-semibold text-zinc-600 dark:text-slate-300">
                    Normal duty To
                  </span>
                  <input
                    type="time"
                    value={extraDraft.normalTo}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        normalTo: e.target.value,
                      }))
                    }
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono"
                  />
                </label>
                <label className="block text-[11px]">
                  <span className="font-semibold text-zinc-600 dark:text-slate-300">
                    Duty (overtime) From
                  </span>
                  <input
                    type="time"
                    value={extraDraft.dutyFrom}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        dutyFrom: e.target.value,
                      }))
                    }
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono"
                  />
                </label>
                <label className="block text-[11px]">
                  <span className="font-semibold text-zinc-600 dark:text-slate-300">
                    Duty (overtime) To
                  </span>
                  <input
                    type="time"
                    value={extraDraft.dutyTo}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        dutyTo: e.target.value,
                      }))
                    }
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono"
                  />
                </label>
                <label className="block text-[11px] sm:col-span-2 lg:col-span-1">
                  <span className="font-semibold text-zinc-600 dark:text-slate-300">
                    Purpose
                  </span>
                  <input
                    type="text"
                    value={extraDraft.purpose}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        purpose: e.target.value,
                      }))
                    }
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-bangla"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addExtraEntry}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-700 hover:bg-sky-800 text-white px-2.5 py-1.5 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add extra day
                </button>
                <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                  OT hours:{" "}
                  {dutyDurationHours(
                    extraDraft.dutyFrom || "00:00",
                    extraDraft.dutyTo || "00:00"
                  )}
                  h
                </span>
              </div>

              {extraDutyEntries.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-sky-200/80 dark:border-sky-500/20">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-sky-100/80 dark:bg-sky-950/40 text-left">
                        <th className="px-2 py-1.5">Date</th>
                        <th className="px-2 py-1.5">Normal</th>
                        <th className="px-2 py-1.5">Duty OT</th>
                        <th className="px-2 py-1.5">Hrs</th>
                        <th className="px-2 py-1.5">Purpose</th>
                        <th className="px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {extraDutyEntries.map((e) => (
                        <tr
                          key={e.date}
                          className="border-t border-sky-100 dark:border-sky-500/10"
                        >
                          <td className="px-2 py-1.5 font-mono align-top">
                            {e.date}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <div className="flex gap-1">
                              <input
                                type="time"
                                value={e.normalFrom}
                                onChange={(ev) =>
                                  updateExtraEntry(e.date, {
                                    normalFrom: ev.target.value,
                                  })
                                }
                                className="w-[5.5rem] rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 font-mono"
                              />
                              <input
                                type="time"
                                value={e.normalTo}
                                onChange={(ev) =>
                                  updateExtraEntry(e.date, {
                                    normalTo: ev.target.value,
                                  })
                                }
                                className="w-[5.5rem] rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 font-mono"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <div className="flex gap-1">
                              <input
                                type="time"
                                value={e.dutyFrom}
                                onChange={(ev) =>
                                  updateExtraEntry(e.date, {
                                    dutyFrom: ev.target.value,
                                  })
                                }
                                className="w-[5.5rem] rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 font-mono"
                              />
                              <input
                                type="time"
                                value={e.dutyTo}
                                onChange={(ev) =>
                                  updateExtraEntry(e.date, {
                                    dutyTo: ev.target.value,
                                  })
                                }
                                className="w-[5.5rem] rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 font-mono"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-1.5 font-mono align-top">
                            {dutyDurationHours(e.dutyFrom, e.dutyTo)}h
                          </td>
                          <td className="px-2 py-1.5 align-top min-w-[8rem]">
                            <input
                              type="text"
                              value={e.purpose}
                              onChange={(ev) =>
                                updateExtraEntry(e.date, {
                                  purpose: ev.target.value,
                                })
                              }
                              className="w-full rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-0.5 font-bangla"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <button
                              type="button"
                              onClick={() => removeExtraEntry(e.date)}
                              className="text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const ok = await handleSave();
                  if (ok) setMode("view");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-2 text-xs font-semibold shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Save to backend"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void load();
                  setMode("view");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-slate-600 px-3.5 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 px-3.5 py-2 text-xs font-semibold"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview sheet
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <InfoTile label="Employee" value={employeeName || "—"} />
              <InfoTile label="Designation" value={designation || "—"} />
              <InfoTile
                label="Weekly holiday"
                value={`${WEEKDAY_LABELS[weeklyHoliday]} (${WEEKDAY_LABELS_BN[weeklyHoliday]})`}
              />
              <InfoTile
                label="Holiday duty shift"
                value={`${shiftMeta.label} · ${shiftMeta.fromDisplay} – ${shiftMeta.toDisplay}`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("preview")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview sheet
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modify
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 px-3.5 py-2 text-xs font-semibold"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      {!loading && mode !== "preview" && (
        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] overflow-hidden shadow-sm print:hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">
              Generated overtime · {MONTH_LABELS[month - 1]} {year}
            </h3>
            <p className="text-xs font-mono text-zinc-600 dark:text-slate-300">
              {rows.length} day{rows.length === 1 ? "" : "s"} ·{" "}
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-bangla">
                {formatDurationBn(totalHours)}
              </span>
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-slate-400">
              No overtime days yet. Use Modify to set weekly holiday / extra days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-slate-900/60 text-zinc-600 dark:text-slate-400">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Normal</th>
                    <th className="px-3 py-2.5">Duty From</th>
                    <th className="px-3 py-2.5">Duty To</th>
                    <th className="px-3 py-2.5 text-right">Hours</th>
                    <th className="px-3 py-2.5 hidden sm:table-cell">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.dateYmd}>
                      <td className="px-4 py-2.5 font-mono">
                        <span className="block font-bangla">{r.dateDisplayBn}</span>
                        <span className="text-[10px] text-zinc-400">
                          {r.isExtra ? "Extra" : "Holiday"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bangla text-[11px]">
                        {r.normalTo
                          ? `${r.normalFrom}–${r.normalTo}`
                          : r.normalFrom}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bangla">
                        {toBengaliDigits(r.dutyFrom)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bangla">
                        {toBengaliDigits(r.dutyTo)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bangla font-semibold text-emerald-700 dark:text-emerald-400">
                        {r.hoursLabelBn}
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell font-bangla truncate max-w-[180px]">
                        {r.purpose}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-semibold">
                    <td className="px-4 py-2.5 font-bangla" colSpan={4}>
                      মোট
                    </td>
                    <td className="px-3 py-2.5 text-right font-bangla">
                      {formatDurationBn(totalHours)}
                    </td>
                    <td className="hidden sm:table-cell" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-zinc-800 dark:text-slate-100 truncate">
        {value}
      </div>
    </div>
  );
}

/** Printable form matching official Overtime Work Form layout */
function OvertimePreviewPage({
  year,
  month,
  employeeName,
  designation,
  rows,
  totalHours,
  saving,
  onSave,
  onDownload,
  onModify,
  onClose,
}: {
  year: number;
  month: number;
  employeeName: string;
  designation: string;
  rows: OvertimeRow[];
  totalHours: number;
  saving: boolean;
  onSave: () => Promise<boolean>;
  onDownload: () => void;
  onModify: () => void;
  onClose: () => void;
}) {
  const monthLabel = MONTH_LABELS[month - 1];

  return (
    <div className="space-y-3">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-white">
            Overtime sheet preview
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-slate-400">
            {monthLabel}-{year} · official form layout
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-1.5 text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Download / Print PDF
          </button>
          <button
            type="button"
            onClick={onModify}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold"
          >
            <Pencil className="w-3.5 h-3.5" />
            Modify
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 dark:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>
      </div>

      <div
        className="bg-white text-black mx-auto shadow-md border border-zinc-300 p-4 sm:p-5 max-w-[1100px] print:shadow-none print:border-0 print:max-w-none"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #overtime-print-root, #overtime-print-root * { visibility: visible !important; }
            #overtime-print-root { position: absolute !important; left: 0; top: 0; width: 100%; }
            @page { size: A4 landscape; margin: 8mm; }
          }
          #overtime-print-root .bn { font-family: "Shonar", "Noto Sans Bengali", "SolaimanLipi", sans-serif; }
        `}</style>
        <div id="overtime-print-root">
          <div className="relative text-center mb-2">
            <div className="absolute right-0 top-0 border border-black px-2 py-0.5 text-[10px] leading-tight">
              33/11 KV Bottail S/S
            </div>
            <div className="text-[14px] font-bold">
              Office of the Executive Engineer
            </div>
            <div className="text-[12px]">Sales &amp; Distribution Division- 1</div>
            <div className="text-[13px] font-bold underline">WZPDCL, Kushtia</div>
          </div>

          <div className="text-[12px] mb-2 space-y-0.5">
            <div>
              <strong>Overtime Work Form</strong>
              {" : "}
              {monthLabel}-{year}
            </div>
            <div>
              <strong>Name of Employee</strong>
              {" : "}
              {employeeName || "—"}
            </div>
            <div>
              <strong>Designation</strong>
              {" : "}
              {designation || "—"}
            </div>
          </div>

          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-black px-1 py-1 bg-zinc-100">
                  Date
                </th>
                <th colSpan={2} className="border border-black px-1 py-1 bg-zinc-100">
                  Normal Working Hour
                </th>
                <th colSpan={2} className="border border-black px-1 py-1 bg-zinc-100">
                  Worked Beyond Normal Time
                </th>
                <th rowSpan={2} className="border border-black px-1 py-1 bg-zinc-100">
                  Total Hour for
                  <br />
                  Extra Working
                </th>
                <th rowSpan={2} className="border border-black px-1 py-1 bg-zinc-100">
                  Purpose of Extra Work
                </th>
                <th colSpan={4} className="border border-black px-1 py-1 bg-zinc-100">
                  Signature
                </th>
                <th rowSpan={2} className="border border-black px-1 py-1 bg-zinc-100">
                  C/S
                  <br />
                  SE
                </th>
              </tr>
              <tr>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">From</th>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">To</th>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">From</th>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">To</th>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">Employee</th>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">SAE</th>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">
                  Controlling
                  <br />
                  Officer
                </th>
                <th className="border border-black px-1 py-0.5 bg-zinc-100">
                  Head of
                  <br />
                  Office
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="border border-black px-2 py-6 text-center">
                    No overtime days
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.dateYmd}>
                    <td className="border border-black px-1 py-1.5 text-center bn">
                      {formatYmdDisplayBn(r.dateYmd)}
                    </td>
                    {r.isExtra ? (
                      <>
                        <td className="border border-black px-1 py-1.5 text-center bn">
                          {r.normalFrom && r.normalFrom !== "—"
                            ? toBengaliDigits(r.normalFrom)
                            : ""}
                        </td>
                        <td className="border border-black px-1 py-1.5 text-center bn">
                          {r.normalTo ? toBengaliDigits(r.normalTo) : ""}
                        </td>
                      </>
                    ) : (
                      <td
                        className="border border-black px-1 py-1.5 text-center bn"
                        colSpan={2}
                      >
                        সাপ্তাহিক বিরতি
                      </td>
                    )}
                    <td className="border border-black px-1 py-1.5 text-center bn">
                      {toBengaliDigits(r.dutyFrom)}
                    </td>
                    <td className="border border-black px-1 py-1.5 text-center bn">
                      {toBengaliDigits(r.dutyTo)}
                    </td>
                    <td className="border border-black px-1 py-1.5 text-center bn">
                      {r.hoursLabelBn}
                    </td>
                    <td className="border border-black px-1.5 py-1.5 text-left bn">
                      {r.purpose}
                    </td>
                    <td className="border border-black px-2 py-3" />
                    <td className="border border-black px-2 py-3" />
                    <td className="border border-black px-2 py-3" />
                    <td className="border border-black px-2 py-3" />
                    <td className="border border-black px-2 py-3" />
                  </tr>
                ))
              )}
              <tr>
                <td
                  className="border border-black px-1 py-1.5 text-center font-bold bn"
                  colSpan={5}
                >
                  মোট
                </td>
                <td className="border border-black px-1 py-1.5 text-center font-bold bn">
                  {formatDurationBn(totalHours)}
                </td>
                <td className="border border-black" colSpan={6} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
