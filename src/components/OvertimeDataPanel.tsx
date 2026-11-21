"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
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
  formatDurationBn,
  formatYmdDisplayBn,
  generateOvertimeRows,
  normalizeDutyShift,
  totalOvertimeHours,
  toBengaliDigits,
  type DutyShiftId,
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
  const [extraDutyDates, setExtraDutyDates] = useState<string[]>([]);
  const [clInput, setClInput] = useState("");
  const [extraInput, setExtraInput] = useState("");
  const [dutyShift, setDutyShift] = useState<DutyShiftId>("C");
  const [purpose, setPurpose] = useState(
    "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<PanelMode>("view");
  const [dirty, setDirty] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
      setExtraDutyDates(
        Array.isArray(sheet.extraDutyDates) ? sheet.extraDutyDates : []
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
        extraDutyDates,
        dutyShift,
        purpose,
      }),
    [year, month, weeklyHoliday, clLeaveDates, extraDutyDates, dutyShift, purpose]
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

  const addExtraDate = () => {
    const v = extraInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      toast.error("Pick a valid extra duty date");
      return;
    }
    const m = v.match(/^(\d{4})-(\d{2})-/);
    if (!m || Number(m[1]) !== year || Number(m[2]) !== month) {
      toast.error("Extra day must be inside the selected month");
      return;
    }
    if (extraDutyDates.includes(v) || clLeaveDates.includes(v)) {
      toast.error("Date already listed");
      return;
    }
    setExtraDutyDates((prev) => [...prev, v].sort());
    setExtraInput("");
    markDirty();
  };

  const removeExtraDate = (ymd: string) => {
    setExtraDutyDates((prev) => prev.filter((d) => d !== ymd));
    markDirty();
  };

  const buildPayload = () => ({
    year,
    month,
    employeeName: employeeName.trim(),
    designation: designation.trim() || "SBA-A",
    weeklyHoliday,
    clLeaveDates,
    extraDutyDates,
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
      toast.success("Overtime data saved to your account");
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    // Same-tab print — no pop-up window (avoids browser block)
    window.print();
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
        printRef={printRef}
        saving={saving}
        onSave={async () => {
          const ok = await handleSave();
          return ok;
        }}
        onDownload={handlePrint}
        onModify={() => setMode("edit")}
        onClose={() => setMode("view")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header strip */}
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
                Auto sheet for current month · saved under your account
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
              disabled={mode === "edit" && dirty}
              className="text-xs rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 font-medium"
              aria-label="Month"
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
              disabled={mode === "edit" && dirty}
              className="text-xs rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 font-medium"
              aria-label="Year"
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
              Modify mode — change variables below, then Save. You can add extra
              duty days that are not your normal weekly holiday.
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
                  placeholder="Md. Mehedy Hasan"
                  required
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
                  placeholder="SBA-A"
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
                  Duty shift on holiday
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

            <p className="text-[11px] text-zinc-500 dark:text-slate-400">
              Selected shift: <strong>{shiftMeta.label}</strong> ·{" "}
              {shiftMeta.fromDisplay} → {shiftMeta.toDisplay} · {shiftMeta.hours}{" "}
              hours each day
            </p>

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
              {clLeaveDates.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {clLeaveDates.map((d) => (
                    <li
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 px-2.5 py-0.5 text-[11px] font-mono text-rose-800 dark:text-rose-200"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => removeClDate(d)}
                        className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/50"
                        aria-label={`Remove ${d}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-slate-400">
                  No CL leave dates.
                </p>
              )}
            </div>

            {/* Extra duty days (not weekly holiday) */}
            <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-sky-50/50 dark:bg-sky-950/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-slate-200">
                  Extra duty days (not normal weekly holiday)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={extraInput}
                  onChange={(e) => setExtraInput(e.target.value)}
                  className="rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={addExtraDate}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-700 hover:bg-sky-800 text-white px-2.5 py-1.5 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add day
                </button>
              </div>
              {extraDutyDates.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {extraDutyDates.map((d) => (
                    <li
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-500/30 px-2.5 py-0.5 text-[11px] font-mono text-sky-800 dark:text-sky-200"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => removeExtraDate(d)}
                        className="p-0.5 rounded hover:bg-sky-100 dark:hover:bg-sky-900/50"
                        aria-label={`Remove ${d}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-slate-400">
                  Optional — add a weekday you performed duty that is not your
                  weekly holiday.
                </p>
              )}
            </div>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                Purpose of Extra Work
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
                {saving ? "Saving…" : "Save to account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void load();
                  setMode("view");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-slate-600 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-slate-200"
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
          /* VIEW mode — auto-generated current (or selected) month summary */
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <InfoTile label="Employee" value={employeeName || "—"} />
              <InfoTile label="Designation" value={designation || "—"} />
              <InfoTile
                label="Weekly holiday"
                value={`${WEEKDAY_LABELS[weeklyHoliday]} (${WEEKDAY_LABELS_BN[weeklyHoliday]})`}
              />
              <InfoTile
                label="Duty shift"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-slate-100"
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

      {/* Generated rows — always visible in view/edit */}
      {!loading && mode !== "preview" && (
        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] overflow-hidden shadow-sm print:hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">
              Auto-generated overtime · {MONTH_LABELS[month - 1]} {year}
            </h3>
            <p className="text-xs font-mono text-zinc-600 dark:text-slate-300">
              {rows.length} day{rows.length === 1 ? "" : "s"} · total{" "}
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {totalHours} h
              </span>{" "}
              <span className="font-bangla">({formatDurationBn(totalHours)})</span>
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-slate-400">
              No overtime days yet. Set weekly holiday / extra days via Modify.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-slate-900/60 text-zinc-600 dark:text-slate-400">
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Shift</th>
                    <th className="px-3 py-2.5 font-semibold">From</th>
                    <th className="px-3 py-2.5 font-semibold">To</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Hours</th>
                    <th className="px-3 py-2.5 font-semibold hidden sm:table-cell">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.dateYmd}>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-800 dark:text-slate-100">
                        <span className="block font-bangla">{r.dateDisplayBn}</span>
                        <span className="text-[10px] text-zinc-400">
                          {r.dateDisplay}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.isExtra ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                            Extra
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 font-bangla">
                            সাপ্তাহিক বিরতি
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-semibold">{r.shift}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        {r.dutyFromDisplay}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        {r.dutyToDisplay}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 font-bangla">
                        {r.hoursLabelBn}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-slate-300 truncate max-w-[200px] hidden sm:table-cell font-bangla">
                        {r.purpose}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-semibold">
                    <td className="px-4 py-2.5 font-bangla" colSpan={5}>
                      মোট (Total)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-800 dark:text-emerald-300 font-bangla">
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

function OvertimePreviewPage({
  year,
  month,
  employeeName,
  designation,
  rows,
  totalHours,
  printRef,
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
  printRef: React.RefObject<HTMLDivElement | null>;
  saving: boolean;
  onSave: () => Promise<boolean>;
  onDownload: () => void;
  onModify: () => void;
  onClose: () => void;
}) {
  const monthLabel = MONTH_LABELS[month - 1];

  return (
    <div className="space-y-3">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-white">
            Overtime sheet preview
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-slate-400">
            {monthLabel}-{year} · use Save / Download or Modify variables
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-slate-100"
          >
            <Pencil className="w-3.5 h-3.5" />
            Modify
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>
      </div>

      {/* Printable sheet */}
      <div
        ref={printRef}
        className="bg-white text-black mx-auto shadow-md border border-zinc-300 p-5 sm:p-6 max-w-[1100px] print:shadow-none print:border-0 print:max-w-none"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #overtime-print-root, #overtime-print-root * { visibility: visible !important; }
            #overtime-print-root {
              position: absolute !important;
              left: 0; top: 0; width: 100%;
            }
            @page { size: A4 landscape; margin: 10mm; }
          }
        `}</style>
        <div id="overtime-print-root">
          <div className="relative text-center mb-3">
            <div className="absolute right-0 top-0 border border-zinc-700 px-2 py-0.5 text-[11px]">
              33/11 KV Bottail S/S
            </div>
            <div className="text-[13px] font-bold">
              Office of the Executive Engineer
            </div>
            <div className="text-[12px]">Sales &amp; Distribution Division- 1</div>
            <div className="text-[13px] font-bold underline">WZPDCL, Kushtia</div>
          </div>

          <div className="text-[12.5px] space-y-0.5 mb-3">
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

          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-zinc-100">
                <th rowSpan={2} className="border border-zinc-700 px-1.5 py-1">
                  Date
                </th>
                <th colSpan={2} className="border border-zinc-700 px-1.5 py-1">
                  Normal Working Hour
                </th>
                <th colSpan={2} className="border border-zinc-700 px-1.5 py-1">
                  Worked Beyond Normal Time
                </th>
                <th rowSpan={2} className="border border-zinc-700 px-1.5 py-1">
                  Total Hour for Extra Working
                </th>
                <th rowSpan={2} className="border border-zinc-700 px-1.5 py-1">
                  Purpose of Extra Work
                </th>
                <th colSpan={4} className="border border-zinc-700 px-1.5 py-1">
                  Signature
                </th>
                <th rowSpan={2} className="border border-zinc-700 px-1.5 py-1">
                  C/S
                  <br />
                  SE
                </th>
              </tr>
              <tr className="bg-zinc-100">
                <th className="border border-zinc-700 px-1 py-0.5">From</th>
                <th className="border border-zinc-700 px-1 py-0.5">To</th>
                <th className="border border-zinc-700 px-1 py-0.5">From</th>
                <th className="border border-zinc-700 px-1 py-0.5">To</th>
                <th className="border border-zinc-700 px-1 py-0.5">Employee</th>
                <th className="border border-zinc-700 px-1 py-0.5">SAE</th>
                <th className="border border-zinc-700 px-1 py-0.5">
                  Controlling Officer
                </th>
                <th className="border border-zinc-700 px-1 py-0.5">
                  Head of Office
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="border border-zinc-700 px-2 py-6 text-center text-zinc-500"
                  >
                    No overtime days generated for this month.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.dateYmd}>
                    <td className="border border-zinc-700 px-1.5 py-1.5 font-mono font-bangla">
                      {formatYmdDisplayBn(r.dateYmd)}
                    </td>
                    <td
                      className="border border-zinc-700 px-1.5 py-1.5 font-bangla"
                      colSpan={2}
                    >
                      {r.isExtra ? "অতিরিক্ত ডিউটি" : "সাপ্তাহিক বিরতি"}
                    </td>
                    <td className="border border-zinc-700 px-1.5 py-1.5 font-mono font-bangla">
                      {toBengaliDigits(r.dutyFrom)}
                    </td>
                    <td className="border border-zinc-700 px-1.5 py-1.5 font-mono font-bangla">
                      {toBengaliDigits(r.dutyTo)}
                    </td>
                    <td className="border border-zinc-700 px-1.5 py-1.5 font-bangla">
                      {r.hoursLabelBn}
                    </td>
                    <td className="border border-zinc-700 px-1.5 py-1.5 text-left font-bangla">
                      {r.purpose}
                    </td>
                    <td className="border border-zinc-700 px-3 py-3" />
                    <td className="border border-zinc-700 px-3 py-3" />
                    <td className="border border-zinc-700 px-3 py-3" />
                    <td className="border border-zinc-700 px-3 py-3" />
                    <td className="border border-zinc-700 px-3 py-3" />
                  </tr>
                ))
              )}
              <tr>
                <td className="border border-zinc-700 px-1.5 py-1.5 font-bold font-bangla" colSpan={5}>
                  মোট
                </td>
                <td className="border border-zinc-700 px-1.5 py-1.5 font-bold font-bangla">
                  {formatDurationBn(totalHours)}
                </td>
                <td className="border border-zinc-700" colSpan={6} />
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[10px] text-zinc-500 print:hidden">
            Shonar Bangla font · Bottail SS operator dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
