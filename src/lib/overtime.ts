/**
 * Monthly overtime sheet helpers for Bottail SS duty operators.
 * Weekly-holiday overtime: all calendar dates in the month that fall on the
 * configured weekly holiday, excluding CL (casual leave) dates.
 */

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

/** Convert ASCII digits in a string to Bengali numerals */
export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Parse "HH:mm" → minutes from midnight (0–1439). Invalid → null */
export function parseHmToMinutes(hm: string): number | null {
  const m = String(hm || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

/**
 * Duration in hours between dutyFrom and dutyTo.
 * Supports overnight shifts (e.g. 22:00 → 06:00 = 8).
 */
export function dutyDurationHours(dutyFrom: string, dutyTo: string): number {
  const a = parseHmToMinutes(dutyFrom);
  const b = parseHmToMinutes(dutyTo);
  if (a == null || b == null) return 0;
  let diff = b - a;
  if (diff <= 0) diff += 24 * 60; // overnight
  return Math.round((diff / 60) * 100) / 100;
}

export function formatDurationBn(hours: number): string {
  const whole = Math.round(hours);
  return `${toBengaliDigits(whole)} ঘন্টা`;
}

/** YYYY-MM-DD for a civil date (no TZ shift — pure calendar) */
export function ymdFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Display date as DD-MM-YYYY (ASCII) */
export function formatYmdDisplay(ymd: string): string {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Display date as DD-MM-YYYY with Bengali digits */
export function formatYmdDisplayBn(ymd: string): string {
  return toBengaliDigits(formatYmdDisplay(ymd));
}

export interface OvertimeRow {
  dateYmd: string;
  dateDisplay: string;
  dateDisplayBn: string;
  normalFrom: string;
  normalTo: string;
  dutyFrom: string;
  dutyTo: string;
  hours: number;
  hoursLabel: string;
  hoursLabelBn: string;
  purpose: string;
}

export interface OvertimeGenerateInput {
  year: number;
  month: number; // 1–12
  weeklyHoliday: number; // 0=Sun … 6=Sat
  clLeaveDates: string[]; // YYYY-MM-DD
  dutyFrom: string;
  dutyTo: string;
  purpose?: string;
}

const DEFAULT_PURPOSE = "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়";

/**
 * All dates in the given month that fall on `weeklyHoliday`, excluding CL leave days.
 * Uses pure civil calendar (not station TZ) — same as form dates.
 */
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

  const dutyFrom = String(input.dutyFrom || "22:00").trim() || "22:00";
  const dutyTo = String(input.dutyTo || "06:00").trim() || "06:00";
  const hours = dutyDurationHours(dutyFrom, dutyTo);
  const purpose = String(input.purpose || DEFAULT_PURPOSE).trim() || DEFAULT_PURPOSE;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rows: OvertimeRow[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    // UTC noon avoids DST edge cases; weekday is calendar-correct
    const wd = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    if (wd !== weeklyHoliday) continue;
    const ymd = ymdFromParts(year, month, day);
    if (clSet.has(ymd)) continue;

    rows.push({
      dateYmd: ymd,
      dateDisplay: formatYmdDisplay(ymd),
      dateDisplayBn: formatYmdDisplayBn(ymd),
      normalFrom: "সাপ্তাহিক বিরতি",
      normalTo: "",
      dutyFrom,
      dutyTo,
      hours,
      hoursLabel: `${hours} hours`,
      hoursLabelBn: formatDurationBn(hours),
      purpose,
    });
  }

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
  dutyFrom: string;
  dutyTo: string;
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
    dutyFrom: defaults?.dutyFrom || "22:00",
    dutyTo: defaults?.dutyTo || "06:00",
    purpose: defaults?.purpose || DEFAULT_PURPOSE,
  };
}
