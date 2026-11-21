/**
 * Monthly overtime sheet helpers for Bottail SS duty operators.
 *
 * Weekly-holiday rows use the configured weekly holiday day + duty shift.
 * Extra duty rows carry their own normal hours, duty hours, and purpose.
 */

export type DutyShiftId = "A" | "B" | "C";

export const DUTY_SHIFTS: Record<
  DutyShiftId,
  {
    id: DutyShiftId;
    label: string;
    from: string;
    to: string;
    fromDisplay: string;
    toDisplay: string;
    hours: number;
  }
> = {
  A: {
    id: "A",
    label: "A Shift",
    from: "06:00",
    to: "14:00",
    fromDisplay: "06:00 AM",
    toDisplay: "02:00 PM",
    hours: 8,
  },
  B: {
    id: "B",
    label: "B Shift",
    from: "14:00",
    to: "22:00",
    fromDisplay: "02:00 PM",
    toDisplay: "10:00 PM",
    hours: 8,
  },
  C: {
    id: "C",
    label: "C Shift",
    from: "22:00",
    to: "06:00",
    fromDisplay: "10:00 PM",
    toDisplay: "06:00 AM",
    hours: 8,
  },
};

export function normalizeDutyShift(value: unknown): DutyShiftId {
  const s = String(value || "").trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C") return s;
  return "C";
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_LABELS_BN = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
] as const;

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function formatDurationBn(hours: number): string {
  const whole = Math.round(hours);
  return `${toBengaliDigits(whole)} ঘন্টা`;
}

export function ymdFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatYmdDisplay(ymd: string): string {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function formatYmdDisplayBn(ymd: string): string {
  return toBengaliDigits(formatYmdDisplay(ymd));
}

/** Parse "HH:mm" → minutes from midnight */
export function parseHmToMinutes(hm: string): number | null {
  const m = String(hm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

/** Duration hours; supports overnight (22:00 → 06:00 = 8) */
export function dutyDurationHours(dutyFrom: string, dutyTo: string): number {
  const a = parseHmToMinutes(dutyFrom);
  const b = parseHmToMinutes(dutyTo);
  if (a == null || b == null) return 0;
  let diff = b - a;
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

export interface ExtraDutyEntry {
  date: string;
  normalFrom: string;
  normalTo: string;
  dutyFrom: string;
  dutyTo: string;
  purpose: string;
}

export interface OvertimeRow {
  dateYmd: string;
  dateDisplay: string;
  dateDisplayBn: string;
  isExtra: boolean;
  shift: DutyShiftId | "";
  normalFrom: string;
  normalTo: string;
  dutyFrom: string;
  dutyTo: string;
  dutyFromDisplay: string;
  dutyToDisplay: string;
  hours: number;
  hoursLabel: string;
  hoursLabelBn: string;
  purpose: string;
}

export interface OvertimeGenerateInput {
  year: number;
  month: number;
  weeklyHoliday: number;
  clLeaveDates: string[];
  extraDutyEntries: ExtraDutyEntry[];
  dutyShift: DutyShiftId;
  purpose?: string;
}

const DEFAULT_PURPOSE = "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়";

function hmDisplay(hm: string): string {
  const mins = parseHmToMinutes(hm);
  if (mins == null) return hm;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function generateOvertimeRows(input: OvertimeGenerateInput): OvertimeRow[] {
  const year = Number(input.year);
  const month = Number(input.month);
  const weeklyHoliday = Number(input.weeklyHoliday);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isFinite(weeklyHoliday) ||
    weeklyHoliday < 0 ||
    weeklyHoliday > 6
  ) {
    return [];
  }

  const clSet = new Set(
    (input.clLeaveDates || [])
      .map((d) => String(d || "").trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );

  const shift = normalizeDutyShift(input.dutyShift);
  const meta = DUTY_SHIFTS[shift];
  const purpose =
    String(input.purpose || DEFAULT_PURPOSE).trim() || DEFAULT_PURPOSE;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const holidayYmds: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const wd = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    if (wd !== weeklyHoliday) continue;
    const ymd = ymdFromParts(year, month, day);
    if (clSet.has(ymd)) continue;
    holidayYmds.push(ymd);
  }

  const holidaySet = new Set(holidayYmds);
  const rows: OvertimeRow[] = [];

  for (const ymd of holidayYmds) {
    rows.push({
      dateYmd: ymd,
      dateDisplay: formatYmdDisplay(ymd),
      dateDisplayBn: formatYmdDisplayBn(ymd),
      isExtra: false,
      shift,
      normalFrom: "সাপ্তাহিক বিরতি",
      normalTo: "",
      dutyFrom: meta.from,
      dutyTo: meta.to,
      dutyFromDisplay: meta.fromDisplay,
      dutyToDisplay: meta.toDisplay,
      hours: meta.hours,
      hoursLabel: `${meta.hours} hours`,
      hoursLabelBn: formatDurationBn(meta.hours),
      purpose,
    });
  }

  for (const entry of input.extraDutyEntries || []) {
    const ymd = String(entry.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const m = ymd.match(/^(\d{4})-(\d{2})-/);
    if (!m || Number(m[1]) !== year || Number(m[2]) !== month) continue;
    if (clSet.has(ymd)) continue;
    if (holidaySet.has(ymd)) continue;

    const dutyFrom = String(entry.dutyFrom || "22:00").trim() || "22:00";
    const dutyTo = String(entry.dutyTo || "06:00").trim() || "06:00";
    const hours = dutyDurationHours(dutyFrom, dutyTo);
    const normalFrom = String(entry.normalFrom || "").trim();
    const normalTo = String(entry.normalTo || "").trim();
    const entryPurpose =
      String(entry.purpose || "").trim() || purpose || "অতিরিক্ত ডিউটি";

    rows.push({
      dateYmd: ymd,
      dateDisplay: formatYmdDisplay(ymd),
      dateDisplayBn: formatYmdDisplayBn(ymd),
      isExtra: true,
      shift: "",
      normalFrom: normalFrom || "—",
      normalTo: normalTo || "",
      dutyFrom,
      dutyTo,
      dutyFromDisplay: hmDisplay(dutyFrom),
      dutyToDisplay: hmDisplay(dutyTo),
      hours,
      hoursLabel: `${hours} hours`,
      hoursLabelBn: formatDurationBn(hours),
      purpose: entryPurpose,
    });
  }

  rows.sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));
  return rows;
}

export function totalOvertimeHours(rows: OvertimeRow[]): number {
  return rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
}

export interface OvertimeSheetRecord {
  id?: string;
  userId: string;
  year: number;
  month: number;
  employeeName: string;
  designation: string;
  weeklyHoliday: number;
  clLeaveDates: string[];
  extraDutyEntries: ExtraDutyEntry[];
  dutyShift: DutyShiftId;
  purpose: string;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export function defaultOvertimeSheet(
  userId: string,
  year: number,
  month: number,
  defaults?: Partial<OvertimeSheetRecord>
): OvertimeSheetRecord {
  return {
    userId,
    year,
    month,
    employeeName: defaults?.employeeName || "",
    designation: defaults?.designation || "SBA-A",
    weeklyHoliday:
      typeof defaults?.weeklyHoliday === "number" ? defaults.weeklyHoliday : 0,
    clLeaveDates: Array.isArray(defaults?.clLeaveDates)
      ? defaults!.clLeaveDates
      : [],
    extraDutyEntries: Array.isArray(defaults?.extraDutyEntries)
      ? defaults!.extraDutyEntries
      : [],
    dutyShift: normalizeDutyShift(defaults?.dutyShift ?? "C"),
    purpose: defaults?.purpose || DEFAULT_PURPOSE,
  };
}

export function currentDhakaYearMonth(): { year: number; month: number } {
  const shifted = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

export function emptyExtraEntry(date = ""): ExtraDutyEntry {
  return {
    date,
    normalFrom: "09:00",
    normalTo: "17:00",
    dutyFrom: "22:00",
    dutyTo: "06:00",
    purpose: DEFAULT_PURPOSE,
  };
}
