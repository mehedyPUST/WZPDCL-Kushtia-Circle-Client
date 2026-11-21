"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Eye,
  FileText,
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
  dutyDurationHours,
  formatDurationBn,
  formatYmdDisplayBn,
  generateOvertimeRows,
  totalOvertimeHours,
  toBengaliDigits,
  type OvertimeRow,
  type OvertimeSheetRecord,
} from "@/lib/overtime";

interface OvertimeDataPanelProps {
  displayName?: string;
  username?: string;
}

function currentYearMonth() {
  const d = new Date();
  // Prefer Dhaka calendar day for "current" month selection
  const shifted = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

export default function OvertimeDataPanel({
  displayName = "",
  username = "",
}: OvertimeDataPanelProps) {
  const init = currentYearMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [employeeName, setEmployeeName] = useState(displayName || "");
  const [designation, setDesignation] = useState("SBA-A");
  const [weeklyHoliday, setWeeklyHoliday] = useState(0);
  const [clLeaveDates, setClLeaveDates] = useState<string[]>([]);
  const [clInput, setClInput] = useState("");
  const [dutyFrom, setDutyFrom] = useState("22:00");
  const [dutyTo, setDutyTo] = useState("06:00");
  const [purpose, setPurpose] = useState(
    "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOvertimeSheet({ year, month });
      const sheet = (data.sheet || {}) as OvertimeSheetRecord;
      setEmployeeName(sheet.employeeName || displayName || "");
      setDesignation(sheet.designation || "SBA-A");
      setWeeklyHoliday(
        typeof sheet.weeklyHoliday === "number" ? sheet.weeklyHoliday : 0
      );
      setClLeaveDates(
        Array.isArray(sheet.clLeaveDates) ? sheet.clLeaveDates : []
      );
      setDutyFrom(sheet.dutyFrom || "22:00");
      setDutyTo(sheet.dutyTo || "06:00");
      setPurpose(
        sheet.purpose || "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
      );
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load overtime data");
    } finally {
      setLoading(false);
    }
  }, [year, month, displayName]);

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
        dutyFrom,
        dutyTo,
        purpose,
      }),
    [year, month, weeklyHoliday, clLeaveDates, dutyFrom, dutyTo, purpose]
  );

  const totalHours = useMemo(() => totalOvertimeHours(rows), [rows]);
  const hoursPerDay = dutyDurationHours(dutyFrom, dutyTo);

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

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }
    setSaving(true);
    try {
      await saveOvertimeSheet({
        year,
        month,
        employeeName: employeeName.trim(),
        designation: designation.trim() || "SBA-A",
        weeklyHoliday,
        clLeaveDates,
        dutyFrom,
        dutyTo,
        purpose,
      });
      setDirty(false);
      toast.success("Overtime data saved");
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const yearOptions = useMemo(() => {
    const y = init.year;
    return [y - 1, y, y + 1];
  }, [init.year]);

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="rounded-xl border bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/30 border-amber-200/80 dark:from-amber-950/40 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25 overflow-hidden shadow-sm">
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
                Monthly weekly-holiday duty sheet · saved under your account
                {username ? ` (${username})` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
              }}
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
              onChange={(e) => setYear(Number(e.target.value))}
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
        ) : (
          <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4">
            {/* Employee identity */}
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

            {/* Weekly holiday + duty window */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  Duty From
                </span>
                <input
                  type="time"
                  value={dutyFrom}
                  onChange={(e) => {
                    setDutyFrom(e.target.value);
                    markDirty();
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                  Duty To
                </span>
                <input
                  type="time"
                  value={dutyTo}
                  onChange={(e) => {
                    setDutyTo(e.target.value);
                    markDirty();
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
                />
              </label>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Each holiday duty counts as{" "}
              <span className="font-semibold text-zinc-700 dark:text-slate-200">
                {hoursPerDay} hour{hoursPerDay === 1 ? "" : "s"}
              </span>{" "}
              ({dutyFrom} → {dutyTo}
              {parseInt(dutyTo, 10) < parseInt(dutyFrom, 10) ? " next day" : ""})
            </p>

            {/* CL leave dates */}
            <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-900/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-slate-200">
                  CL leave taken days (excluded from overtime)
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
                  No CL leave dates — all weekly holidays in the month count as
                  overtime.
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
                className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-2 text-xs font-semibold shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving…" : dirty ? "Save changes" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 px-3.5 py-2 text-xs font-semibold"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview sheet PDF
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Generated rows summary */}
      {!loading && (
        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">
              Generated overtime days · {MONTH_LABELS[month - 1]} {year}
            </h3>
            <p className="text-xs font-mono text-zinc-600 dark:text-slate-300">
              {rows.length} day{rows.length === 1 ? "" : "s"} · total{" "}
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {totalHours} h
              </span>{" "}
              ({formatDurationBn(totalHours)})
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-slate-400">
              No overtime days for this month (check weekly holiday or CL leave
              exclusions).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-slate-900/60 text-zinc-600 dark:text-slate-400">
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Normal</th>
                    <th className="px-3 py-2.5 font-semibold">Duty From</th>
                    <th className="px-3 py-2.5 font-semibold">Duty To</th>
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
                        <span className="block">{r.dateDisplayBn}</span>
                        <span className="text-[10px] text-zinc-400">
                          {r.dateDisplay}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-slate-300">
                        {r.normalFrom}
                      </td>
                      <td className="px-3 py-2.5 font-mono">{r.dutyFrom}</td>
                      <td className="px-3 py-2.5 font-mono">{r.dutyTo}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {r.hoursLabelBn}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-slate-300 truncate max-w-[200px] hidden sm:table-cell">
                        {r.purpose}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-semibold">
                    <td className="px-4 py-2.5" colSpan={4}>
                      মোট (Total)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-800 dark:text-emerald-300">
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

      {previewOpen && (
        <OvertimePreviewModal
          year={year}
          month={month}
          employeeName={employeeName}
          designation={designation}
          rows={rows}
          totalHours={totalHours}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function OvertimePreviewModal({
  year,
  month,
  employeeName,
  designation,
  rows,
  totalHours,
  onClose,
}: {
  year: number;
  month: number;
  employeeName: string;
  designation: string;
  rows: OvertimeRow[];
  totalHours: number;
  onClose: () => void;
}) {
  const monthLabel = MONTH_LABELS[month - 1];
  const printId = "overtime-print-sheet";

  const handlePrint = () => {
    const el = document.getElementById(printId);
    if (!el) return;
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Overtime Work Form — ${monthLabel}-${year}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; color: #111; margin: 0; padding: 8px; font-size: 12px; }
  .header { text-align: center; margin-bottom: 10px; position: relative; }
  .header h1 { font-size: 15px; margin: 2px 0; font-weight: 700; }
  .header h2 { font-size: 13px; margin: 2px 0; text-decoration: underline; }
  .badge { position: absolute; right: 0; top: 0; border: 1px solid #333; padding: 3px 8px; font-size: 11px; }
  .meta { margin: 10px 0 8px; font-size: 12.5px; }
  .meta div { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #222; padding: 4px 5px; vertical-align: middle; }
  th { background: #f3f3f3; font-weight: 700; text-align: center; }
  td { text-align: center; }
  td.left { text-align: left; }
  .total-row td { font-weight: 700; }
  .sig-note { margin-top: 14px; font-size: 10px; color: #444; }
</style></head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Overtime sheet preview"
    >
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-xl bg-white dark:bg-[#0f1726] border border-zinc-200 dark:border-slate-700 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900/50">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-white">
            Overtime sheet preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto p-4 sm:p-6 bg-zinc-100/80 dark:bg-slate-950/40">
          <div
            id={printId}
            className="bg-white text-black mx-auto shadow-md border border-zinc-300 p-5 sm:p-6 max-w-[1100px]"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            <div className="header relative text-center mb-3">
              <div className="badge absolute right-0 top-0 border border-zinc-700 px-2 py-0.5 text-[11px]">
                33/11 KV Bottail S/S
              </div>
              <div className="text-[13px] font-bold">
                Office of the Executive Engineer
              </div>
              <div className="text-[12px]">
                Sales &amp; Distribution Division- 1
              </div>
              <div className="text-[13px] font-bold underline">
                WZPDCL, Kushtia
              </div>
            </div>

            <div className="meta text-[12.5px] space-y-0.5 mb-3">
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
                      <td className="border border-zinc-700 px-1.5 py-1.5 font-mono">
                        {formatYmdDisplayBn(r.dateYmd)}
                      </td>
                      <td className="border border-zinc-700 px-1.5 py-1.5" colSpan={2}>
                        সাপ্তাহিক বিরতি
                      </td>
                      <td className="border border-zinc-700 px-1.5 py-1.5 font-mono">
                        {toBengaliDigits(r.dutyFrom)}
                      </td>
                      <td className="border border-zinc-700 px-1.5 py-1.5 font-mono">
                        {toBengaliDigits(r.dutyTo)}
                      </td>
                      <td className="border border-zinc-700 px-1.5 py-1.5">
                        {r.hoursLabelBn}
                      </td>
                      <td className="border border-zinc-700 px-1.5 py-1.5 left text-left">
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
                <tr className="total-row">
                  <td
                    className="border border-zinc-700 px-1.5 py-1.5"
                    colSpan={5}
                  >
                    মোট
                  </td>
                  <td className="border border-zinc-700 px-1.5 py-1.5">
                    {formatDurationBn(totalHours)}
                  </td>
                  <td className="border border-zinc-700" colSpan={6} />
                </tr>
              </tbody>
            </table>
            <p className="sig-note mt-3 text-[10px] text-zinc-500">
              Generated from Bottail SS operator dashboard · Print or save as PDF
              from your browser print dialog.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
