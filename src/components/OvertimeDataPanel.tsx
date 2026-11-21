"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchOvertimeSheet, saveOvertimeSheet } from "@/lib/overtimeApi";
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
  /** When set, load/save this duty person's sheet (duty/admin shared access) */
  targetUserId?: string;
  targetDisplayName?: string;
  /** Optional controlled year/month (e.g. from team list) */
  initialYear?: number;
  initialMonth?: number;
  /** Called after a successful save (e.g. to refresh team list) */
  onSaved?: () => void;
  /** Optional initial modal mode when opened from Monthly Overtime Sheets */
  initialModalMode?: ModalMode;
}

type ModalMode = "preview" | "modify" | null;

export default function OvertimeDataPanel({
  displayName = "",
  username = "",
  targetUserId,
  targetDisplayName = "",
  initialYear,
  initialMonth,
  onSaved,
  initialModalMode = null,
}: OvertimeDataPanelProps) {
  const init = currentDhakaYearMonth();
  const [year, setYear] = useState(initialYear ?? init.year);
  const [month, setMonth] = useState(initialMonth ?? init.month);
  const nameFallback = targetDisplayName || displayName || "";
  const [employeeName, setEmployeeName] = useState(nameFallback);
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
  const initialOpenedRef = useRef(false);
  const [extraDraft, setExtraDraft] = useState<ExtraDutyEntry>(emptyExtraEntry());

  const applySheet = useCallback(
    (sheet: Partial<OvertimeSheetRecord>) => {
      setEmployeeName(sheet.employeeName || nameFallback || "");
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
    [nameFallback]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOvertimeSheet({
        year,
        month,
        userId: targetUserId || undefined,
      });
      applySheet((data.sheet || {}) as OvertimeSheetRecord);
      if (initialModalMode && !initialOpenedRef.current) {
        initialOpenedRef.current = true;
        setModalMode(initialModalMode);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load overtime data");
    } finally {
      setLoading(false);
    }
  }, [year, month, targetUserId, applySheet, initialModalMode]);

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
    ...(targetUserId ? { userId: targetUserId } : {}),
  });

  const handleSave = async () => {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return false;
    }
    setSaving(true);
    try {
      await saveOvertimeSheet(buildPayload());
      toast.success(
        targetUserId
          ? "Overtime data saved for this duty person"
          : "Overtime data saved to backend"
      );
      onSaved?.();
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
                {targetUserId
                  ? `Managing sheet for ${nameFallback || username}${username ? ` (@${username})` : ""}`
                  : `Saved on backend under your user id${username ? ` (${username})` : ""}`}
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
          onDownload={() =>
            printOvertimeSheet(
              `Overtime_${MONTH_LABELS[month - 1]}_${year}`
            )
          }
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
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-[2px] print:static print:block print:bg-transparent print:backdrop-blur-none print:p-0 print:inset-auto print:overflow-visible print:h-auto print:min-h-0"
      role="dialog"
      aria-modal="true"
      aria-label="Overtime sheet"
    >
      <div className="w-full max-w-6xl max-h-[96vh] overflow-hidden rounded-xl bg-zinc-100 dark:bg-[#0b1220] border border-zinc-300 dark:border-slate-700 shadow-2xl flex flex-col print:block print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:shadow-none print:border-0 print:rounded-none print:bg-white">
        {/* Toolbar */}
        <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1726]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                {mode === "modify" ? "Modify Overtime Sheet" : "Overtime Sheet Preview"}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {monthLabel}-{year} · Official form layout
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download / Print PDF
            </button>
            {mode === "preview" ? (
              <button
                type="button"
                onClick={() => onSwitchMode("modify")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modify
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSwitchMode("preview")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-100 px-3.5 py-2 text-xs font-semibold shadow-sm transition"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview only
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 sm:p-4 print:p-0 print:overflow-visible print:h-auto print:flex-none">
          {/* ─── Professional Modify Form ───────────────────────────────────── */}
          {mode === "modify" && (
            <div className="print:hidden mb-5 space-y-4">
              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-[#0f1726] px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                      Modify Overtime Sheet
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Changes update the official form live · Click Save when finished
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-1.5 shadow-sm">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Total OT
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      overCap
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {totalHours}h
                  </span>
                  <span className="text-[10px] text-slate-400">
                    / {MAX_OVERTIME_HOURS}h
                  </span>
                </div>
              </div>

              {/* Employee & Shift settings */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-2.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Employee &amp; Shift Settings
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Name of Employee
                    </span>
                    <input
                      type="text"
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Designation
                    </span>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Weekly Holiday
                    </span>
                    <select
                      value={weeklyHoliday}
                      onChange={(e) => setWeeklyHoliday(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                    >
                      {WEEKDAY_LABELS.map((label, i) => (
                        <option key={label} value={i}>
                          {label} ({WEEKDAY_LABELS_BN[i]})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Duty Shift (on holiday)
                    </span>
                    <select
                      value={dutyShift}
                      onChange={(e) =>
                        setDutyShift(normalizeDutyShift(e.target.value))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
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
                  <label className="block space-y-1 sm:col-span-2 lg:col-span-4">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Default Purpose (weekly holiday duty)
                    </span>
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition font-bangla"
                    />
                  </label>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Holiday shift currently set to{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {shiftMeta.label}
                  </span>{" "}
                  · {shiftMeta.fromDisplay} – {shiftMeta.toDisplay}
                </div>
              </div>

              {/* CL Leave Days */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/20 px-4 py-2.5">
                  <CalendarDays className="h-3.5 w-3.5 text-rose-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    CL Leave Days
                  </span>
                  <span className="ml-auto text-[10px] text-slate-400">
                    These dates are excluded from overtime
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Select date
                      </span>
                      <input
                        type="date"
                        value={clInput}
                        onChange={(e) => setClInput(e.target.value)}
                        className="block rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addClDate}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-semibold shadow-sm transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add CL Day
                    </button>
                  </div>
                  {clLeaveDates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {clLeaveDates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 px-3 py-1 text-xs font-mono text-rose-800 dark:text-rose-200"
                        >
                          {d}
                          <button
                            type="button"
                            onClick={() => removeClDate(d)}
                            className="rounded-full p-0.5 hover:bg-rose-200/60 dark:hover:bg-rose-800/40 transition"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      No CL leave days added yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Extra Duty Days */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1726] shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-sky-50/60 dark:bg-sky-950/20 px-4 py-2.5">
                  <Clock className="h-3.5 w-3.5 text-sky-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Extra Duty Days
                  </span>
                  <span className="ml-auto text-[10px] text-slate-400">
                    Days that are not weekly holidays
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {/* Add new extra day form */}
                  <div className="rounded-lg border border-slate-150 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 space-y-3">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Add a new extra duty day
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-medium text-slate-500">Date</span>
                        <input
                          type="date"
                          value={extraDraft.date}
                          onChange={(e) =>
                            setExtraDraft((d) => ({ ...d, date: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-medium text-slate-500">Normal From</span>
                        <input
                          type="time"
                          value={extraDraft.normalFrom}
                          onChange={(e) =>
                            setExtraDraft((d) => ({
                              ...d,
                              normalFrom: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-medium text-slate-500">Normal To</span>
                        <input
                          type="time"
                          value={extraDraft.normalTo}
                          onChange={(e) =>
                            setExtraDraft((d) => ({
                              ...d,
                              normalTo: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-medium text-slate-500">Duty From</span>
                        <input
                          type="time"
                          value={extraDraft.dutyFrom}
                          onChange={(e) =>
                            setExtraDraft((d) => ({
                              ...d,
                              dutyFrom: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-medium text-slate-500">Duty To</span>
                        <input
                          type="time"
                          value={extraDraft.dutyTo}
                          onChange={(e) =>
                            setExtraDraft((d) => ({
                              ...d,
                              dutyTo: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
                        />
                      </label>
                      <label className="block space-y-1 sm:col-span-2 lg:col-span-1">
                        <span className="text-[10px] font-medium text-slate-500">Purpose</span>
                        <input
                          type="text"
                          value={extraDraft.purpose}
                          onChange={(e) =>
                            setExtraDraft((d) => ({
                              ...d,
                              purpose: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition font-bangla"
                          placeholder="Purpose of extra work"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={addExtraEntry}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Extra Day
                      <span className="ml-1 rounded bg-sky-500/40 px-1.5 py-0.5 text-[10px] font-medium">
                        {dutyDurationHours(extraDraft.dutyFrom, extraDraft.dutyTo)}h
                      </span>
                    </button>
                  </div>

                  {/* Existing extra entries table */}
                  {extraDutyEntries.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/60 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <th className="px-3 py-2.5 font-semibold">Date</th>
                            <th className="px-3 py-2.5 font-semibold">Normal Hours</th>
                            <th className="px-3 py-2.5 font-semibold">Duty / OT Hours</th>
                            <th className="px-3 py-2.5 font-semibold">Purpose</th>
                            <th className="px-3 py-2.5 font-semibold w-10" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {extraDutyEntries.map((e) => (
                            <tr
                              key={e.date}
                              className="bg-white dark:bg-[#0f1726] hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition"
                            >
                              <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                {e.date}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="time"
                                    value={e.normalFrom}
                                    onChange={(ev) =>
                                      updateExtraEntry(e.date, {
                                        normalFrom: ev.target.value,
                                      })
                                    }
                                    className="w-[5.2rem] rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono text-[11px] shadow-sm"
                                  />
                                  <span className="text-slate-400 text-[10px]">→</span>
                                  <input
                                    type="time"
                                    value={e.normalTo}
                                    onChange={(ev) =>
                                      updateExtraEntry(e.date, {
                                        normalTo: ev.target.value,
                                      })
                                    }
                                    className="w-[5.2rem] rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono text-[11px] shadow-sm"
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="time"
                                    value={e.dutyFrom}
                                    onChange={(ev) =>
                                      updateExtraEntry(e.date, {
                                        dutyFrom: ev.target.value,
                                      })
                                    }
                                    className="w-[5.2rem] rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono text-[11px] shadow-sm"
                                  />
                                  <span className="text-slate-400 text-[10px]">→</span>
                                  <input
                                    type="time"
                                    value={e.dutyTo}
                                    onChange={(ev) =>
                                      updateExtraEntry(e.date, {
                                        dutyTo: ev.target.value,
                                      })
                                    }
                                    className="w-[5.2rem] rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 font-mono text-[11px] shadow-sm"
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={e.purpose}
                                  onChange={(ev) =>
                                    updateExtraEntry(e.date, {
                                      purpose: ev.target.value,
                                    })
                                  }
                                  className="w-full min-w-[8rem] rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-bangla shadow-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeExtraEntry(e.date)}
                                  className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                  title="Remove entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {extraDutyEntries.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic text-center py-2">
                      No extra duty days added yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}


          {overCap && (
            <div className="print:hidden mb-4 rounded-xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3.5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300">
                  <span className="text-sm font-bold">!</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                    Overtime limit exceeded
                  </p>
                  <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-200">
                    Monthly limit is <strong>{MAX_OVERTIME_HOURS}h</strong> — current total is{" "}
                    <strong>{totalHours}h</strong>. Remove day(s) below so the sheet stays within limit, then Save.
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {rows.map((r) => (
                      <li
                        key={r.dateYmd}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/90 dark:bg-black/25 border border-rose-100 dark:border-rose-800/40 px-3 py-1.5"
                      >
                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-200">
                          {r.dateDisplay} · {r.hours}h · {r.isExtra ? "Extra" : "Weekly holiday"}
                        </span>
                        <button
                          type="button"
                          onClick={() => excludeDay(r.dateYmd)}
                          className="rounded-md bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-[11px] font-semibold shadow-sm transition"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {excludedDates.length > 0 && (
            <div className="print:hidden mb-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-[11px] text-slate-600 dark:text-slate-300 shadow-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Excluded days
              </span>
              <span className="text-slate-400 ml-1">(click to restore)</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {excludedDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => restoreDay(d)}
                    className="inline-flex items-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2.5 py-1 font-mono text-[11px] hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-600 transition"
                  >
                    {d}
                  </button>
                ))}
              </div>
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

/**
 * Prints the overtime sheet from an isolated off-screen iframe.
 * Avoids window.open (blocked in iframes / returns null with noopener)
 * and prevents app-shell 100dvh/overflow clipping and dark-mode leakage.
 */
function printOvertimeSheet(docTitle = "Overtime_Work_Form") {
  const root = document.getElementById("overtime-print-root");
  if (!root) {
    window.print();
    return;
  }

  const origin = window.location.origin;
  const fontUrl = new URL("/SHONAR.TTF", origin).href;
  const logoUrl = new URL("/wzpdcl-form-logo.jpeg", origin).href;

  const clone = root.cloneNode(true) as HTMLElement;
  clone.style.minWidth = "0";
  clone.style.width = "100%";

  clone.querySelectorAll("img").forEach((img) => {
    const rawSrc = img.getAttribute("src") || "";
    if (!rawSrc || rawSrc.includes("wzpdcl-form-logo")) {
      img.setAttribute("src", logoUrl);
    } else {
      img.setAttribute("src", new URL(rawSrc, window.location.href).href);
    }
  });

  const safeTitle = docTitle.replace(/[<>:"/\\|?*]+/g, "_");

  const styles = `
    @font-face {
      font-family: "Shonar";
      src: url("${fontUrl}") format("truetype");
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    @page {
      size: A4 landscape;
      margin: 5mm 6mm 6mm 6mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      padding: 1mm 2mm 2mm;
    }
    #overtime-print-root {
      width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .bn {
      font-family: "Shonar", "Noto Sans Bengali", "SolaimanLipi", "Kalpurush", sans-serif;
    }
    table.ot {
      border-collapse: collapse;
      table-layout: fixed;
      width: 100%;
      page-break-inside: auto;
    }
    table.ot thead {
      display: table-header-group;
    }
    table.ot th,
    table.ot td {
      border: 1px solid #000;
      padding: 3.5px 3px;
      vertical-align: middle !important;
      text-align: center !important;
      font-size: 11px;
      line-height: 1.25;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    table.ot thead th {
      font-weight: 700;
      font-size: 10.5px;
      background: #fff;
    }
    table.ot tbody tr:not(.ot-spacer) td {
      font-size: 11.5px;
      height: 36px;
    }
    table.ot td.bn {
      font-size: 12px;
    }
    table.ot tr {
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: auto;
    }
    table.ot tr.ot-spacer {
      page-break-before: avoid;
      break-before: avoid;
    }
    table.ot tr.ot-spacer td {
      height: 18px !important;
      padding: 0 3px !important;
      line-height: 16px !important;
      font-size: 10px !important;
      background-color: #f5f5f5 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
    }
    .meta-table td {
      border: none !important;
      padding: 2px 6px 2px 0;
      font-size: 12.5px;
      vertical-align: middle;
    }
    img {
      max-width: 84px;
      max-height: 84px;
      height: auto;
    }
  `;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>${styles}</style>
  </head>
  <body>${clone.outerHTML}</body>
</html>`;

  const existing = document.getElementById("overtime-print-iframe");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "overtime-print-iframe";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "1120px";
  iframe.style.height = "790px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  document.body.appendChild(iframe);

  const iframeWin = iframe.contentWindow;
  const iframeDoc = iframe.contentDocument || iframeWin?.document;
  if (!iframeWin || !iframeDoc) {
    iframe.remove();
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframeWin.addEventListener("afterprint", cleanup, { once: true });
      window.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 60000);
      iframeWin.focus();
      iframeWin.print();
    } catch {
      cleanup();
      window.print();
    }
  };

  const waitForImages = async () => {
    const imgs = Array.from(iframeDoc.images || []);
    if (imgs.length === 0) return;
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
      )
    );
  };

  const waitForFonts = async () => {
    try {
      if (iframeDoc.fonts?.ready) {
        await iframeDoc.fonts.ready;
      }
    } catch {
      /* ignore */
    }
  };

  const safetyTimer = window.setTimeout(doPrint, 1800);
  Promise.all([waitForImages(), waitForFonts()]).then(() => {
    window.clearTimeout(safetyTimer);
    window.setTimeout(doPrint, 80);
  });
}

/**
 * Pixel-faithful overtime sheet matching "Overtime Form M H-2.pdf"
 * Header: circular logo LEFT | titles CENTER | boxed station RIGHT
 * Table: all cells middle/center aligned; tight top margin for print
 */
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
      className="bg-white text-black mx-auto overflow-x-auto print:overflow-visible print:shadow-none print:border-0 print:p-0"
      style={{
        fontFamily: "'Times New Roman', Times, serif",
        maxWidth: 1100,
        padding: "6px 10px 12px",
        border: "1px solid #ccc",
      }}
    >
      <style>{`
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * { visibility: hidden !important; }
          #overtime-print-root,
          #overtime-print-root * {
            visibility: visible !important;
          }
          #overtime-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 2mm 4mm 6mm !important;
            background: #fff !important;
            border: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #overtime-print-root table.ot {
            table-layout: fixed;
            width: 100%;
            page-break-inside: auto;
          }
          #overtime-print-root table.ot thead {
            display: table-header-group;
          }
          #overtime-print-root table.ot tr {
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: auto;
          }
          #overtime-print-root table.ot tr.ot-spacer {
            page-break-before: avoid;
            break-before: avoid;
          }
          #overtime-print-root table.ot tr.ot-spacer td {
            height: 18px !important;
            padding: 0 3px !important;
            line-height: 16px !important;
            font-size: 10px !important;
            background-color: #f5f5f5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 landscape;
            margin: 5mm 6mm 6mm 6mm;
          }
        }
        #overtime-print-root .bn {
          font-family: "Shonar", "Noto Sans Bengali", "SolaimanLipi", sans-serif;
        }
        #overtime-print-root table.ot {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
        }
        #overtime-print-root table.ot th,
        #overtime-print-root table.ot td {
          border: 1px solid #000;
          padding: 3.5px 3px;
          vertical-align: middle !important;
          text-align: center !important;
          font-size: 11px;
          line-height: 1.25;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }
        #overtime-print-root table.ot thead th {
          font-weight: 700;
          font-size: 10.5px;
          background: #fff;
        }
        #overtime-print-root table.ot tbody tr:not(.ot-spacer) td {
          font-size: 11.5px;
          height: 36px;
        }
        #overtime-print-root table.ot td.bn {
          font-size: 12px;
        }
        #overtime-print-root table.ot tr.ot-spacer td {
          height: 18px !important;
          padding: 0 3px !important;
          line-height: 16px !important;
          font-size: 10px !important;
          background-color: #f5f5f5 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #overtime-print-root .meta-table td {
          border: none !important;
          padding: 2px 6px 2px 0;
          font-size: 12.5px;
          vertical-align: middle;
        }
      `}</style>

      <div id="overtime-print-root" style={{ minWidth: 860 }}>
        {/* ===== HEADER ===== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 165px",
            alignItems: "center",
            gap: 10,
            marginTop: 0,
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src="/wzpdcl-form-logo.jpeg"
              alt="WZPDCL"
              width={84}
              height={84}
              style={{ width: 84, height: 84, objectFit: "contain" }}
            />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
              Office of the Executive Engineer
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.3 }}>
              Sales &amp; Distribution Division- 1
            </div>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                textDecoration: "underline",
                lineHeight: 1.35,
              }}
            >
              WZPDCL, Kushtia
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
            <div
              style={{
                border: "1.5px solid #000",
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                lineHeight: 1.25,
                textAlign: "center",
              }}
            >
              33/11 KV Bottail S/S
            </div>
          </div>
        </div>

        {/* ===== META ===== */}
        <table className="meta-table" style={{ marginBottom: 8, marginTop: 2 }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                Overtime Work Form
              </td>
              <td style={{ fontWeight: 700 }}>:</td>
              <td style={{ fontWeight: 700 }}>
                {monthLabel}-{year}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                Name of Employee
              </td>
              <td style={{ fontWeight: 700 }}>:</td>
              <td style={{ fontWeight: 700 }}>{employeeName || "—"}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                Designation
              </td>
              <td style={{ fontWeight: 700 }}>:</td>
              <td style={{ fontWeight: 700 }}>{designation || "—"}</td>
            </tr>
          </tbody>
        </table>

        {/* ===== MAIN TABLE — all cells center + middle aligned ===== */}
        <table className="ot">
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>Date</th>
              <th colSpan={2}>Normal Working Hour</th>
              <th colSpan={2}>Worked Beyond Normal Time</th>
              <th rowSpan={2}>
                Total Hour
                <br />
                for Extra
                <br />
                Working
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
                <td colSpan={12} style={{ padding: 16, color: "#666" }}>
                  No overtime days
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.dateYmd}>
                  <tr>
                    <td className="bn" style={{ whiteSpace: "nowrap" }}>
                      {formatYmdDisplayBn(r.dateYmd)}
                    </td>
                    {r.isExtra ? (
                      <>
                        <td className="bn" style={{ whiteSpace: "nowrap" }}>
                          {r.normalFrom && r.normalFrom !== "—"
                            ? toBengaliDigits(r.normalFrom)
                            : ""}
                        </td>
                        <td className="bn" style={{ whiteSpace: "nowrap" }}>
                          {r.normalTo ? toBengaliDigits(r.normalTo) : ""}
                        </td>
                      </>
                    ) : (
                      <td className="bn" colSpan={2}>
                        সাপ্তাহিক বিরতি
                      </td>
                    )}
                    <td className="bn" style={{ whiteSpace: "nowrap" }}>
                      {toBengaliDigits(r.dutyFrom)}
                    </td>
                    <td className="bn" style={{ whiteSpace: "nowrap" }}>
                      {toBengaliDigits(r.dutyTo)}
                    </td>
                    <td className="bn" style={{ whiteSpace: "nowrap" }}>
                      {`${toBengaliDigits(Math.round(r.hours))} ঘণ্টা`}
                    </td>
                    <td className="bn">{r.purpose}</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                  <tr className="ot-spacer" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                </Fragment>
              ))
            )}
            <tr>
              <td />
              <td />
              <td />
              <td />
              <td className="bn" style={{ fontWeight: 700 }}>
                মোট
              </td>
              <td className="bn" style={{ fontWeight: 700 }}>
                {`${toBengaliDigits(Math.round(totalHours))} ঘণ্টা`}
              </td>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
