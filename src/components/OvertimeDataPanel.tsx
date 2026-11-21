"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
  MAX_OVERTIME_HOURS,
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

type ModalMode = "preview" | "modify" | null;

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
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [clInput, setClInput] = useState("");
  const [dutyShift, setDutyShift] = useState<DutyShiftId>("C");
  const [purpose, setPurpose] = useState(
    "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
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
      setExcludedDates(
        Array.isArray(sheet.excludedDates) ? sheet.excludedDates : []
      );
      setDutyShift(normalizeDutyShift(sheet.dutyShift ?? "C"));
      setPurpose(
        sheet.purpose || "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
      );
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
        excludedDates,
        extraDutyEntries,
        dutyShift,
        purpose,
      }),
    [year, month, weeklyHoliday, clLeaveDates, excludedDates, extraDutyEntries, dutyShift, purpose]
  );

  const totalHours = useMemo(() => totalOvertimeHours(rows), [rows]);
  const overCap = totalHours > MAX_OVERTIME_HOURS;
  const shiftMeta = DUTY_SHIFTS[dutyShift];

  const excludeDay = (ymd: string) => {
    setExcludedDates((prev) =>
      prev.includes(ymd) ? prev : [...prev, ymd].sort()
    );
  };
  const restoreDay = (ymd: string) => {
    setExcludedDates((prev) => prev.filter((d) => d !== ymd));
  };

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
  };

  const removeClDate = (ymd: string) => {
    setClLeaveDates((prev) => prev.filter((d) => d !== ymd));
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
  };

  const updateExtraEntry = (date: string, patch: Partial<ExtraDutyEntry>) => {
    setExtraDutyEntries((prev) =>
      prev.map((e) => (e.date === date ? { ...e, ...patch } : e))
    );
  };

  const removeExtraEntry = (date: string) => {
    setExtraDutyEntries((prev) => prev.filter((e) => e.date !== date));
  };

  const buildPayload = () => ({
    year,
    month,
    employeeName: employeeName.trim(),
    designation: designation.trim() || "SBA-A",
    weeklyHoliday,
    clLeaveDates,
    excludedDates,
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
              onChange={(e) => setMonth(Number(e.target.value))}
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
              onChange={(e) => setYear(Number(e.target.value))}
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
                onClick={() => setModalMode("preview")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview sheet
              </button>
              <button
                type="button"
                onClick={() => setModalMode("modify")}
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

      {!loading && (
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

          {overCap && (
            <div className="mx-4 mb-3 mt-3 rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 text-xs text-rose-900 dark:text-rose-100">
              <p className="font-semibold">
                Overtime exceeds the monthly limit of {MAX_OVERTIME_HOURS} hours
                (currently {totalHours} h).
              </p>
              <p className="mt-1 text-[11px] opacity-90">
                Remove one or more day rows below so the total is at most{" "}
                {MAX_OVERTIME_HOURS} hours, then Save.
              </p>
              <ul className="mt-2 space-y-1">
                {rows.map((r) => (
                  <li
                    key={r.dateYmd}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 dark:bg-black/20 px-2 py-1"
                  >
                    <span className="font-mono">
                      {r.dateDisplay} · {r.hours}h ·{" "}
                      {r.isExtra ? "Extra" : "Holiday"}
                    </span>
                    <button
                      type="button"
                      onClick={() => excludeDay(r.dateYmd)}
                      className="rounded bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 text-[11px] font-semibold"
                    >
                      Remove this day
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {excludedDates.length > 0 && !overCap && (
            <div className="mx-4 mb-3 mt-3 rounded-lg border border-zinc-200 dark:border-slate-600 bg-zinc-50 dark:bg-slate-900/40 px-3 py-2 text-[11px] text-zinc-600 dark:text-slate-300">
              <span className="font-semibold">Excluded days: </span>
              {excludedDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => restoreDay(d)}
                  className="inline-flex items-center gap-1 mr-1.5 mt-1 rounded-full border border-zinc-300 dark:border-slate-600 px-2 py-0.5 font-mono hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  title="Restore this day"
                >
                  {d} ×
                </button>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-slate-400">
              No overtime days yet. Click Modify to set weekly holiday / extra days.
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

      {modalMode && (
        <OvertimeSheetModal
          mode={modalMode}
          year={year}
          month={month}
          employeeName={employeeName}
          designation={designation}
          weeklyHoliday={weeklyHoliday}
          clLeaveDates={clLeaveDates}
          excludedDates={excludedDates}
          extraDutyEntries={extraDutyEntries}
          dutyShift={dutyShift}
          purpose={purpose}
          clInput={clInput}
          extraDraft={extraDraft}
          rows={rows}
          totalHours={totalHours}
          overCap={overCap}
          saving={saving}
          onClose={() => setModalMode(null)}
          onSwitchMode={(m) => setModalMode(m)}
          onSave={async () => handleSave()}
          onDownload={() => window.print()}
          setEmployeeName={setEmployeeName}
          setDesignation={setDesignation}
          setWeeklyHoliday={setWeeklyHoliday}
          setDutyShift={setDutyShift}
          setPurpose={setPurpose}
          setClInput={setClInput}
          setExtraDraft={setExtraDraft}
          addClDate={addClDate}
          removeClDate={removeClDate}
          addExtraEntry={addExtraEntry}
          updateExtraEntry={updateExtraEntry}
          removeExtraEntry={removeExtraEntry}
          excludeDay={excludeDay}
          restoreDay={restoreDay}
        />
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

function OvertimeSheetModal({
  mode,
  year,
  month,
  employeeName,
  designation,
  weeklyHoliday,
  clLeaveDates,
  extraDutyEntries,
  dutyShift,
  purpose,
  clInput,
  extraDraft,
  rows,
  totalHours,
  saving,
  onClose,
  onSwitchMode,
  onSave,
  onDownload,
  setEmployeeName,
  setDesignation,
  setWeeklyHoliday,
  setDutyShift,
  setPurpose,
  setClInput,
  setExtraDraft,
  addClDate,
  removeClDate,
  addExtraEntry,
  updateExtraEntry,
  removeExtraEntry,
  excludedDates,
  overCap,
  excludeDay,
  restoreDay,
}: {
  mode: "preview" | "modify";
  year: number;
  month: number;
  employeeName: string;
  designation: string;
  weeklyHoliday: number;
  clLeaveDates: string[];
  extraDutyEntries: ExtraDutyEntry[];
  dutyShift: DutyShiftId;
  purpose: string;
  clInput: string;
  extraDraft: ExtraDutyEntry;
  rows: OvertimeRow[];
  totalHours: number;
  saving: boolean;
  onClose: () => void;
  onSwitchMode: (m: "preview" | "modify") => void;
  onSave: () => Promise<boolean>;
  onDownload: () => void;
  setEmployeeName: (v: string) => void;
  setDesignation: (v: string) => void;
  setWeeklyHoliday: (v: number) => void;
  setDutyShift: (v: DutyShiftId) => void;
  setPurpose: (v: string) => void;
  setClInput: (v: string) => void;
  setExtraDraft: React.Dispatch<React.SetStateAction<ExtraDutyEntry>>;
  addClDate: () => void;
  removeClDate: (d: string) => void;
  addExtraEntry: () => void;
  updateExtraEntry: (date: string, patch: Partial<ExtraDutyEntry>) => void;
  removeExtraEntry: (date: string) => void;
  excludedDates: string[];
  overCap: boolean;
  excludeDay: (ymd: string) => void;
  restoreDay: (ymd: string) => void;
}) {
  const monthLabel = MONTH_LABELS[month - 1];
  const shiftMeta = DUTY_SHIFTS[dutyShift];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-[2px] print:static print:bg-transparent print:p-0 print:inset-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Overtime sheet"
    >
      <div className="w-full max-w-6xl max-h-[96vh] overflow-hidden rounded-xl bg-zinc-100 dark:bg-[#0b1220] border border-zinc-300 dark:border-slate-700 shadow-2xl flex flex-col print:max-w-none print:max-h-none print:shadow-none print:border-0 print:rounded-none print:bg-white">
        {/* Toolbar */}
        <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-zinc-200 dark:border-slate-700 bg-white dark:bg-[#0f1726]">
          <div>
            <h2 className="text-sm font-bold text-zinc-800 dark:text-white">
              {mode === "modify" ? "Modify overtime sheet" : "Overtime sheet preview"}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-slate-400">
              {monthLabel}-{year} · official form layout
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
            {mode === "preview" ? (
              <button
                type="button"
                onClick={() => onSwitchMode("modify")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modify
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSwitchMode("preview")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 px-3 py-1.5 text-xs font-semibold"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview only
              </button>
            )}
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

        <div className="overflow-y-auto flex-1 p-2 sm:p-4 print:p-0">
          {/* Modify form inside modal */}
          {mode === "modify" && (
            <div className="print:hidden mb-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-[#0f1726] p-3 sm:p-4 space-y-3 text-xs">
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                Edit variables below — the PDF sheet updates live. Click Save to
                store on backend.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="font-semibold text-zinc-500 dark:text-slate-400">
                    Name of Employee
                  </span>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-zinc-500 dark:text-slate-400">
                    Designation
                  </span>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-zinc-500 dark:text-slate-400">
                    Weekly Holiday
                  </span>
                  <select
                    value={weeklyHoliday}
                    onChange={(e) => setWeeklyHoliday(Number(e.target.value))}
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5"
                  >
                    {WEEKDAY_LABELS.map((label, i) => (
                      <option key={label} value={i}>
                        {label} ({WEEKDAY_LABELS_BN[i]})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-zinc-500 dark:text-slate-400">
                    Duty shift on weekly holiday
                  </span>
                  <select
                    value={dutyShift}
                    onChange={(e) =>
                      setDutyShift(normalizeDutyShift(e.target.value))
                    }
                    className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5"
                  >
                    {(Object.keys(DUTY_SHIFTS) as DutyShiftId[]).map((id) => {
                      const s = DUTY_SHIFTS[id];
                      return (
                        <option key={id} value={id}>
                          {s.label} — {s.fromDisplay} to {s.toDisplay}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="font-semibold text-zinc-500 dark:text-slate-400">
                  Default purpose (weekly holiday)
                </span>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 font-bangla"
                />
              </label>

              <div className="rounded-lg border border-zinc-200 dark:border-slate-700 p-2 space-y-2">
                <div className="font-semibold text-zinc-600 dark:text-slate-300 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-rose-500" />
                  CL leave days
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="date"
                    value={clInput}
                    onChange={(e) => setClInput(e.target.value)}
                    className="rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={addClDate}
                    className="rounded bg-zinc-800 dark:bg-slate-100 text-white dark:text-slate-900 px-2 py-1 font-semibold"
                  >
                    Add
                  </button>
                  {clLeaveDates.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 font-mono"
                    >
                      {d}
                      <button type="button" onClick={() => removeClDate(d)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-sky-200 dark:border-sky-500/30 p-2 space-y-2">
                <div className="font-semibold text-zinc-600 dark:text-slate-300">
                  Extra duty days (not weekly holiday)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                  <input
                    type="date"
                    value={extraDraft.date}
                    onChange={(e) =>
                      setExtraDraft((d) => ({ ...d, date: e.target.value }))
                    }
                    className="rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono"
                    title="Date"
                  />
                  <input
                    type="time"
                    value={extraDraft.normalFrom}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        normalFrom: e.target.value,
                      }))
                    }
                    className="rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono"
                    title="Normal From"
                  />
                  <input
                    type="time"
                    value={extraDraft.normalTo}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        normalTo: e.target.value,
                      }))
                    }
                    className="rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono"
                    title="Normal To"
                  />
                  <input
                    type="time"
                    value={extraDraft.dutyFrom}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        dutyFrom: e.target.value,
                      }))
                    }
                    className="rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono"
                    title="Duty From"
                  />
                  <input
                    type="time"
                    value={extraDraft.dutyTo}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        dutyTo: e.target.value,
                      }))
                    }
                    className="rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono"
                    title="Duty To"
                  />
                  <input
                    type="text"
                    value={extraDraft.purpose}
                    onChange={(e) =>
                      setExtraDraft((d) => ({
                        ...d,
                        purpose: e.target.value,
                      }))
                    }
                    className="rounded border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-bangla"
                    placeholder="Purpose"
                  />
                </div>
                <button
                  type="button"
                  onClick={addExtraEntry}
                  className="inline-flex items-center gap-1 rounded bg-sky-700 text-white px-2 py-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add extra day ({dutyDurationHours(extraDraft.dutyFrom, extraDraft.dutyTo)}h)
                </button>
                {extraDutyEntries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-left bg-sky-50 dark:bg-sky-950/30">
                          <th className="px-1 py-1">Date</th>
                          <th className="px-1 py-1">Normal</th>
                          <th className="px-1 py-1">Duty OT</th>
                          <th className="px-1 py-1">Purpose</th>
                          <th className="px-1 py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {extraDutyEntries.map((e) => (
                          <tr key={e.date} className="border-t border-sky-100 dark:border-sky-900/40">
                            <td className="px-1 py-1 font-mono">{e.date}</td>
                            <td className="px-1 py-1">
                              <input type="time" value={e.normalFrom} onChange={(ev) => updateExtraEntry(e.date, { normalFrom: ev.target.value })} className="w-[4.8rem] rounded border px-0.5 font-mono bg-white dark:bg-slate-900" />
                              <input type="time" value={e.normalTo} onChange={(ev) => updateExtraEntry(e.date, { normalTo: ev.target.value })} className="w-[4.8rem] rounded border px-0.5 font-mono bg-white dark:bg-slate-900 ml-0.5" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="time" value={e.dutyFrom} onChange={(ev) => updateExtraEntry(e.date, { dutyFrom: ev.target.value })} className="w-[4.8rem] rounded border px-0.5 font-mono bg-white dark:bg-slate-900" />
                              <input type="time" value={e.dutyTo} onChange={(ev) => updateExtraEntry(e.date, { dutyTo: ev.target.value })} className="w-[4.8rem] rounded border px-0.5 font-mono bg-white dark:bg-slate-900 ml-0.5" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="text" value={e.purpose} onChange={(ev) => updateExtraEntry(e.date, { purpose: ev.target.value })} className="w-full min-w-[6rem] rounded border px-1 font-bangla bg-white dark:bg-slate-900" />
                            </td>
                            <td className="px-1 py-1">
                              <button type="button" onClick={() => removeExtraEntry(e.date)}>
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">
                Holiday shift: {shiftMeta.label} · {shiftMeta.fromDisplay} – {shiftMeta.toDisplay}
              </p>
            </div>
          )}


          {overCap && (
            <div className="print:hidden mb-3 rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 text-xs text-rose-900 dark:text-rose-100">
              <p className="font-semibold">
                Monthly overtime limit is {MAX_OVERTIME_HOURS} hours — current total is {totalHours} h.
              </p>
              <p className="mt-1 text-[11px]">
                Remove a day row so the sheet stays within {MAX_OVERTIME_HOURS} hours, then Save.
              </p>
              <ul className="mt-2 space-y-1">
                {rows.map((r) => (
                  <li
                    key={r.dateYmd}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/80 dark:bg-black/20 px-2 py-1"
                  >
                    <span className="font-mono text-[11px]">
                      {r.dateDisplay} · {r.hours}h · {r.isExtra ? "Extra" : "Weekly holiday"}
                    </span>
                    <button
                      type="button"
                      onClick={() => excludeDay(r.dateYmd)}
                      className="rounded bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 text-[11px] font-semibold"
                    >
                      Remove this day
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {excludedDates.length > 0 && (
            <div className="print:hidden mb-3 rounded-lg border border-zinc-200 dark:border-slate-600 bg-zinc-50 dark:bg-slate-900/40 px-3 py-2 text-[11px] text-zinc-600 dark:text-slate-300">
              <span className="font-semibold">Excluded (click to restore): </span>
              {excludedDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => restoreDay(d)}
                  className="inline-flex items-center mr-1.5 mt-1 rounded-full border border-zinc-300 dark:border-slate-600 px-2 py-0.5 font-mono hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  {d} ×
                </button>
              ))}
            </div>
          )}

          {/* Official PDF sheet */}
          <OfficialOvertimeSheet
            year={year}
            month={month}
            employeeName={employeeName}
            designation={designation}
            rows={rows}
            totalHours={totalHours}
          />
        </div>
      </div>
    </div>
  );
}

/** Matches the official Overtime Work Form (DOCX) exactly */
function OfficialOvertimeSheet({
  year,
  month,
  employeeName,
  designation,
  rows,
  totalHours,
}: {
  year: number;
  month: number;
  employeeName: string;
  designation: string;
  rows: OvertimeRow[];
  totalHours: number;
}) {
  const monthLabel = MONTH_LABELS[month - 1];

  return (
    <div
      className="bg-white text-black mx-auto shadow-md border border-zinc-300 p-3 sm:p-4 max-w-[1100px] print:shadow-none print:border-0 print:max-w-none"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #overtime-print-root, #overtime-print-root * { visibility: visible !important; }
          #overtime-print-root {
            position: absolute !important;
            left: 0; top: 0; width: 100%;
            background: white !important;
          }
          @page { size: A4 landscape; margin: 8mm; }
        }
        #overtime-print-root .bn {
          font-family: "Shonar", "Noto Sans Bengali", "SolaimanLipi", sans-serif;
        }
        #overtime-print-root table {
          border-collapse: collapse;
          width: 100%;
        }
        #overtime-print-root th,
        #overtime-print-root td {
          border: 1px solid #000;
          padding: 4px 5px;
          vertical-align: middle;
        }
        #overtime-print-root th {
          background: #f3f3f3;
          font-weight: 700;
          text-align: center;
        }
      `}</style>

      <div id="overtime-print-root">
        {/* Header — logo + office lines (same order as official form) */}
        <div className="flex items-start gap-3 mb-3">
          <img
            src="/logo.png"
            alt="WZPDCL"
            width={58}
            height={58}
            className="w-[58px] h-[58px] object-contain shrink-0"
          />
          <div className="flex-1 text-center">
            <div className="text-[14px] font-bold leading-snug">
              Office of the Executive Engineer
            </div>
            <div className="text-[12px] font-semibold leading-snug">
              33/11 KV Bottail S/S
            </div>
            <div className="text-[12px] leading-snug">
              Sales &amp; Distribution Division- 1
            </div>
            <div className="text-[13px] font-bold underline leading-snug">
              WZPDCL, Kushtia
            </div>
          </div>
          {/* spacer so title stays centered vs logo */}
          <div className="w-[58px] shrink-0" aria-hidden />
        </div>

        {/* Meta fields */}
        <table className="mb-3 text-[12px]" style={{ border: "none", width: "auto" }}>
          <tbody>
            <tr>
              <td style={{ border: "none", padding: "1px 8px 1px 0", fontWeight: 700 }}>
                Overtime Work Form
              </td>
              <td style={{ border: "none", padding: "1px 4px" }}>:</td>
              <td style={{ border: "none", padding: "1px 4px", fontWeight: 700 }}>
                {monthLabel}-{year}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "1px 8px 1px 0", fontWeight: 700 }}>
                Name of Employee
              </td>
              <td style={{ border: "none", padding: "1px 4px" }}>:</td>
              <td style={{ border: "none", padding: "1px 4px", fontWeight: 700 }}>
                {employeeName || "—"}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "1px 8px 1px 0", fontWeight: 700 }}>
                Designation
              </td>
              <td style={{ border: "none", padding: "1px 4px" }}>:</td>
              <td style={{ border: "none", padding: "1px 4px", fontWeight: 700 }}>
                {designation || "—"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main grid — exact columns from official DOCX */}
        <table className="w-full text-[10.5px]">
          <thead>
            <tr>
              <th rowSpan={2}>Date</th>
              <th colSpan={2}>Normal Working Hour</th>
              <th colSpan={2}>Worked Beyond Normal Time</th>
              <th rowSpan={2}>
                Total Hour for
                <br />
                Extra Working
              </th>
              <th rowSpan={2}>Purpose of Extra Work</th>
              <th colSpan={4}>Signature</th>
              <th rowSpan={2}>
                C/S
                <br />
                SE
              </th>
            </tr>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>From</th>
              <th>To</th>
              <th>Employee</th>
              <th>SAE</th>
              <th>
                Controlling
                <br />
                Officer
              </th>
              <th>
                Head of
                <br />
                Office
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-6 text-zinc-500">
                  No overtime days
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.dateYmd}>
                  <tr>
                    <td className="text-center bn whitespace-nowrap">
                      {formatYmdDisplayBn(r.dateYmd)}
                    </td>
                    {/* Weekly holiday → single label in From, To blank
                        Extra day → From and To both shown */}
                    {r.isExtra ? (
                      <>
                        <td className="text-center bn whitespace-nowrap">
                          {r.normalFrom && r.normalFrom !== "—"
                            ? toBengaliDigits(r.normalFrom)
                            : ""}
                        </td>
                        <td className="text-center bn whitespace-nowrap">
                          {r.normalTo ? toBengaliDigits(r.normalTo) : ""}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-center bn" colSpan={2}>
                          সাপ্তাহিক বিরতি
                        </td>
                      </>
                    )}
                    <td className="text-center bn whitespace-nowrap">
                      {toBengaliDigits(r.dutyFrom)}
                    </td>
                    <td className="text-center bn whitespace-nowrap">
                      {toBengaliDigits(r.dutyTo)}
                    </td>
                    <td className="text-center bn whitespace-nowrap">
                      {r.hoursLabelBn}
                    </td>
                    <td className="text-left bn">{r.purpose}</td>
                    <td style={{ minWidth: 48, height: 28 }} />
                    <td style={{ minWidth: 40 }} />
                    <td style={{ minWidth: 56 }} />
                    <td style={{ minWidth: 48 }} />
                    <td style={{ minWidth: 36 }} />
                  </tr>
                  {/* Blank spacer row like the official form */}
                  <tr aria-hidden>
                    <td colSpan={12} style={{ height: 10, borderTop: "none" }} />
                  </tr>
                </Fragment>
              ))
            )}
            <tr>
              <td colSpan={4} />
              <td className="text-center font-bold bn">মোট</td>
              <td className="text-center font-bold bn">
                {formatDurationBn(totalHours)}
              </td>
              <td colSpan={6} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
