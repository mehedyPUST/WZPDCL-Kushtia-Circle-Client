/**
 * Monthly overtime sheet helpers for Bottail SS duty operators.
 *
 * Weekly-holiday overtime: calendar dates in the month that fall on the
 * configured weekly holiday, excluding CL leave dates, plus any extra
 * (non-holiday) duty dates the user adds.
 *
 * Duty on holiday is recorded by shift, not free-form clock times:
 *   A — 06:00 – 14:00
 *   B — 14:00 – 22:00
 *   C — 22:00 – 06:00 (+1)
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
  const s = String(value || "")
    .trim()
    .toUpperCase();
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

/** Convert ASCII digits in a string to Bengali numerals */
export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function formatDurationBn(hours: number): string {
  const whole = Math.round(hours);
  return `${toBengaliDigits(whole)} ঘন্টা`;
}

/** YYYY-MM-DD for a civil date */
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
  /** true when this date is not on the configured weekly holiday */
  isExtra: boolean;
  shift: DutyShiftId;
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
  month: number; // 1–12
  weeklyHoliday: number; // 0=Sun … 6=Sat
  clLeaveDates: string[]; // YYYY-MM-DD
  /** Extra duty dates that are not the normal weekly holiday */
  extraDutyDates: string[]; // YYYY-MM-DD
  dutyShift: DutyShiftId;
  purpose?: string;
}

const DEFAULT_PURPOSE = "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়";

/**
 * Holiday dates in month (weekly holiday minus CL) plus any extra duty dates.
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

  const extraYmds = (input.extraDutyDates || [])
    .map((d) => String(d || "").trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .filter((d) => {
      const m = d.match(/^(\d{4})-(\d{2})-/);
      if (!m) return false;
      if (Number(m[1]) !== year || Number(m[2]) !== month) return false;
      if (clSet.has(d)) return false;
      if (holidaySet.has(d)) return false;
      return true;
    });

  const allYmds = [...holidayYmds, ...extraYmds].sort();

  return allYmds.map((ymd) => {
    const isExtra = !holidaySet.has(ymd);
    return {
      dateYmd: ymd,
      dateDisplay: formatYmdDisplay(ymd),
      dateDisplayBn: formatYmdDisplayBn(ymd),
      isExtra,
      shift,
      dutyFrom: meta.from,
      dutyTo: meta.to,
      dutyFromDisplay: meta.fromDisplay,
      dutyToDisplay: meta.toDisplay,
      hours: meta.hours,
      hoursLabel: `${meta.hours} hours`,
      hoursLabelBn: formatDurationBn(meta.hours),
      purpose: isExtra ? purpose || "অতিরিক্ত ডিউটি" : purpose,
    };
  });
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
  extraDutyDates: string[];
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
    extraDutyDates: Array.isArray(defaults?.extraDutyDates)
      ? defaults!.extraDutyDates
      : [],
    dutyShift: normalizeDutyShift(defaults?.dutyShift ?? "C"),
    purpose: defaults?.purpose || DEFAULT_PURPOSE,
  };
}

/** Asia/Dhaka current year + month */
export function currentDhakaYearMonth(): { year: number; month: number } {
  const shifted = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}
