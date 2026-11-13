/**
 * Bottail SS operational shifts (local Asia/Dhaka clock):
 *   A — 09:00–14:xx
 *   B — 15:00–20:xx
 *   C — 21:00 → next day 08:xx
 *
 * C-shift entries between 00:00–08:59 belong to the *previous* duty day.
 */

export type ShiftId = "A" | "B" | "C";

export interface ShiftMetaItem {
  id: ShiftId;
  label: string;
  window: string;
  hours: string;
}

export const SHIFT_META: Record<ShiftId, ShiftMetaItem> = {
  A: {
    id: "A",
    label: "A Shift",
    window: "09:00 – 14:00",
    hours: "9–14",
  },
  B: {
    id: "B",
    label: "B Shift",
    window: "15:00 – 20:00",
    hours: "15–20",
  },
  C: {
    id: "C",
    label: "C Shift",
    window: "21:00 – 08:00 (+1)",
    hours: "21–08",
  },
};

/**
 * Map alternate logins and legacy labels to one canonical display identity.
 */
const PERSON_ALIASES: Record<string, string> = {
  admin: "Mehedy",
  "admin-default-1": "Mehedy",
  "bottail ss admin": "Mehedy",
  "bottail.mehedy": "Mehedy",
  "mehedy.bottail": "Mehedy",
  mehedy: "Mehedy",
  "mehedy/admin": "Mehedy",
  "bottail.mehedy/admin": "Mehedy",
  "bottail.dilip": "Dilip",
  "dilip.bottail": "Dilip",
  dilip: "Dilip",
  "bottail.tareq": "Tareq",
  "tareq.bottail": "Tareq",
  tareq: "Tareq",
};

const UNATTRIBUTED_KEYS = new Set([
  "",
  "unknown",
  "null",
  "undefined",
  "none",
  "n/a",
]);

function roundShiftCount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatShiftCount(value: number | null | undefined): string {
  const n = roundShiftCount(Number(value) || 0);
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 10) / 10).toString();
}

export function isUnattributedName(name: string | null | undefined): boolean {
  const key = String(name || "")
    .trim()
    .toLowerCase();
  return UNATTRIBUTED_KEYS.has(key);
}

/**
 * Normalize a username / creator label for roster columns.
 */
export function normalizePersonName(raw: unknown): string {
  const s = String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
  const key = s.toLowerCase();
  if (UNATTRIBUTED_KEYS.has(key)) return "Unknown";

  if (PERSON_ALIASES[key]) return PERSON_ALIASES[key];

  // Strip trailing role suffixes (e.g. "bottail.mehedy/admin")
  const noSlash = key.split("/")[0].trim();
  if (UNATTRIBUTED_KEYS.has(noSlash)) return "Unknown";
  if (PERSON_ALIASES[noSlash]) return PERSON_ALIASES[noSlash];

  // Strip common station prefix/suffix (e.g. "bottail.karim" -> "Karim")
  const stripped = noSlash
    .replace(/^bottail[._-]/i, "")
    .replace(/[._-]bottail$/i, "")
    .trim();
  if (PERSON_ALIASES[stripped]) return PERSON_ALIASES[stripped];

  if (stripped && /^[a-z][a-z0-9 _-]{0,23}$/i.test(stripped)) {
    return stripped
      .split(/[._\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  return s;
}

export function shiftFromHour(hour: unknown): ShiftId {
  const h = Number(hour);
  if (!Number.isFinite(h)) return "A";
  const norm = ((Math.floor(h) % 24) + 24) % 24;
  if (norm >= 9 && norm <= 14) return "A";
  if (norm >= 15 && norm <= 20) return "B";
  return "C";
}

function dhakaPartsFromDate(dt: Date): { ymd: string; hour: number; minute: number } | null {
  if (Number.isNaN(dt.getTime())) return null;
  try {
    const ymd = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dt);
    let hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    if (hour === 24) hour = 0;
    return { ymd, hour, minute };
  } catch {
    const shifted = new Date(dt.getTime() + 6 * 60 * 60 * 1000);
    return {
      ymd: shifted.toISOString().slice(0, 10),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
    };
  }
}

export function dhakaNowParts(now = new Date()): {
  ymd: string;
  hour: number;
  minute: number;
} {
  return (
    dhakaPartsFromDate(now) || {
      ymd: now.toISOString().slice(0, 10),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
    }
  );
}

export function dhakaTodayYmd(now = new Date()): string {
  return dhakaNowParts(now).ymd;
}

/**
 * Parse hour from hourSlot ("14:00", "18:30") or ISO date string in Dhaka,
 * accounting for midnight slot wraparound against timestamp hour.
 */
export function localPartsFromRecord(record: {
  hourSlot?: string | null;
  calculatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}): { hour: number; minute: number; ymd: string } | null {
  const slot = record?.hourSlot && String(record.hourSlot).trim();
  const raw = record?.calculatedAt || record?.createdAt;
  const base = raw ? new Date(raw) : null;
  const baseParts = base ? dhakaPartsFromDate(base) : null;

  let hour: number | null = null;
  let minute = 0;
  let slotUsed = false;

  if (slot && /^\d{1,2}:\d{2}$/.test(slot)) {
    const [hh, mm] = slot.split(":").map(Number);
    if (Number.isFinite(hh) && hh >= 0 && hh <= 24) {
      hour = hh === 24 ? 0 : hh % 24;
      minute = Number.isFinite(mm) ? mm : 0;
      slotUsed = true;
    }
  }

  let ymd: string | null = baseParts?.ymd || null;
  if (slotUsed && baseParts && hour !== null) {
    // Entry saved at 23:xx Dhaka for the upcoming 00:00 slot belongs to next calendar day (then C-shift rolls -1 to tonight)
    if (hour === 0 && baseParts.hour === 23) {
      ymd = addDaysYmd(baseParts.ymd, 1);
    } else if (hour === 23 && baseParts.hour === 0) {
      // Entry saved shortly after midnight for the 23:00 slot belongs to previous calendar evening
      ymd = addDaysYmd(baseParts.ymd, -1);
    }
  } else if (hour === null && baseParts) {
    hour = baseParts.hour;
    minute = baseParts.minute;
  }

  if (hour === null || !ymd) return null;
  return { hour, minute, ymd };
}

/** Add days to YYYY-MM-DD */
export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Map a calculation to duty calendar day + shift.
 */
export function classifyDuty(record: {
  hourSlot?: string | null;
  calculatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}): { dutyDay: string; shift: ShiftId; hour: number } | null {
  const parts = localPartsFromRecord(record);
  if (!parts) return null;
  const shift = shiftFromHour(parts.hour);
  let dutyDay = parts.ymd;
  // Early morning C continues previous evening's duty day
  if (shift === "C" && parts.hour <= 8) {
    dutyDay = addDaysYmd(parts.ymd, -1);
  }
  return { dutyDay, shift, hour: parts.hour };
}

export interface TopRankResult {
  person: string | null;
  winners: string[];
  isTie: boolean;
  share: number;
  entries: number;
  runnersUp: Array<{ person: string; entries: number }>;
  all: Array<{ person: string; entries: number }>;
}

function topOf(counts: Record<string, number> | undefined): TopRankResult {
  const entries = Object.entries(counts || {}).filter(([, val]) => val > 0);
  if (entries.length === 0) {
    return {
      person: null,
      winners: [],
      isTie: false,
      share: 0,
      entries: 0,
      runnersUp: [],
      all: [],
    };
  }
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxVal = entries[0][1];
  const winners = entries
    .filter(([, val]) => Math.abs(val - maxVal) < 1e-9)
    .map(([p]) => p);
  const isTie = winners.length > 1;
  const share = 1 / winners.length;
  return {
    person: isTie ? winners.join(" & ") : winners[0],
    winners,
    isTie,
    share,
    entries: roundShiftCount(maxVal),
    runnersUp: entries
      .filter(([, val]) => val < maxVal - 1e-9)
      .slice(0, 4)
      .map(([p, e]) => ({ person: p, entries: roundShiftCount(e) })),
    all: entries.map(([p, e]) => ({ person: p, entries: roundShiftCount(e) })),
  };
}

export interface PersonDayCell {
  shifts: ShiftId[];
  sharedShifts: ShiftId[];
  label: string;
  entries: number;
  isDuty: boolean;
}

export interface DutyRosterDay {
  day: number;
  ymd: string;
  dateLabel: string;
  weekday: string;
  isToday: boolean;
  isFuture: boolean;
  byPerson: Record<string, PersonDayCell>;
  A: TopRankResult;
  B: TopRankResult;
  C: TopRankResult;
  breakdown: Record<ShiftId, Record<string, number>>;
  coveredShifts: ShiftId[];
  missingShifts: ShiftId[];
  upcomingShifts: ShiftId[];
  unattributedEntries: number;
  totalEntries: number;
}

export interface DutyRosterResult {
  year: number;
  month: number;
  daysInMonth: number;
  todayYmd: string;
  classified: number;
  unattributed: number;
  skipped: number;
  coverage: {
    elapsedDays: number;
    totalShiftSlots: number;
    filledShiftSlots: number;
    uncoveredShiftSlots: number;
    tiedShiftSlots: number;
    coveragePct: number;
  };
  persons: Array<{ person: string; entries: number; shifts: number }>;
  days: DutyRosterDay[];
  leaderboard: Array<{ person: string; shifts: number; entries: number }>;
  shiftLeaders: Record<ShiftId, TopRankResult>;
  shifts: Record<ShiftId, ShiftMetaItem>;
}

/**
 * Aggregate calculations into monthly duty roster.
 * Primary layout: date × person matrix with shift letters (a / b / c).
 */
export function buildMonthlyDutyRoster(
  records: Array<Record<string, any>>,
  year: number,
  month: number,
  options: { todayYmd?: string; todayHour?: number } = {}
): DutyRosterResult {
  const y = Number(year);
  const m = Number(month);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const nowParts = dhakaNowParts();
  const todayYmd = options.todayYmd || nowParts.ymd;
  const todayHour =
    options.todayHour != null ? Number(options.todayHour) : nowParts.hour;

  const byDay: Record<string, Record<ShiftId, Record<string, number>>> = {};
  const dayUnattributed: Record<string, number> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    byDay[ymd] = { A: {}, B: {}, C: {} };
    dayUnattributed[ymd] = 0;
  }

  const personDayShifts: Record<string, Record<string, Set<ShiftId>>> = {};
  const personDaySharedShifts: Record<string, Record<string, Set<ShiftId>>> = {};
  const personTotals: Record<string, number> = {};
  let classified = 0;
  let unattributed = 0;
  let skipped = 0;

  for (const rec of records || []) {
    const c = classifyDuty(rec);
    if (!c || !byDay[c.dutyDay]) {
      skipped++;
      continue;
    }

    const rawName =
      (rec.createdByUsername && String(rec.createdByUsername).trim()) ||
      (rec.createdByDisplayName && String(rec.createdByDisplayName).trim()) ||
      (rec.createdBy && String(rec.createdBy).trim()) ||
      "";
    const who = normalizePersonName(rawName);

    if (isUnattributedName(who)) {
      unattributed++;
      dayUnattributed[c.dutyDay] = (dayUnattributed[c.dutyDay] || 0) + 1;
      continue;
    }

    const bucket = byDay[c.dutyDay][c.shift];
    bucket[who] = (bucket[who] || 0) + 1;
    personTotals[who] = (personTotals[who] || 0) + 1;
    classified++;
  }

  const personShiftCounts: Record<string, number> = {};
  const shiftLeaderTotals: Record<ShiftId, Record<string, number>> = {
    A: {},
    B: {},
    C: {},
  };

  for (const ymd of Object.keys(byDay)) {
    for (const sh of ["A", "B", "C"] as const) {
      const top = topOf(byDay[ymd][sh]);
      if (top.winners.length === 0) continue;
      for (const winner of top.winners) {
        if (!personDayShifts[winner]) personDayShifts[winner] = {};
        if (!personDayShifts[winner][ymd]) {
          personDayShifts[winner][ymd] = new Set();
        }
        personDayShifts[winner][ymd].add(sh);

        if (top.isTie) {
          if (!personDaySharedShifts[winner]) personDaySharedShifts[winner] = {};
          if (!personDaySharedShifts[winner][ymd]) {
            personDaySharedShifts[winner][ymd] = new Set();
          }
          personDaySharedShifts[winner][ymd].add(sh);
        }

        personShiftCounts[winner] = (personShiftCounts[winner] || 0) + top.share;
        shiftLeaderTotals[sh][winner] =
          (shiftLeaderTotals[sh][winner] || 0) + top.share;
      }
    }
  }

  // Round accumulated shift shares cleanly
  for (const k of Object.keys(personShiftCounts)) {
    personShiftCounts[k] = roundShiftCount(personShiftCounts[k]);
  }
  for (const sh of ["A", "B", "C"] as const) {
    for (const k of Object.keys(shiftLeaderTotals[sh])) {
      shiftLeaderTotals[sh][k] = roundShiftCount(shiftLeaderTotals[sh][k]);
    }
  }

  const allNames = new Set([
    ...Object.keys(personTotals),
    ...Object.keys(personShiftCounts),
  ]);
  const persons = [...allNames]
    .map((person) => ({
      person,
      entries: personTotals[person] || 0,
      shifts: personShiftCounts[person] || 0,
    }))
    .sort(
      (a, b) =>
        b.shifts - a.shifts ||
        b.entries - a.entries ||
        a.person.localeCompare(b.person)
    );

  const days: DutyRosterDay[] = [];
  const shiftOrder: ShiftId[] = ["A", "B", "C"];
  const shiftStartHour: Record<ShiftId, number> = { A: 9, B: 15, C: 21 };

  let elapsedDays = 0;
  let totalShiftSlots = 0;
  let filledShiftSlots = 0;
  let tiedShiftSlots = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cell = byDay[ymd];
    const dutyA = topOf(cell.A);
    const dutyB = topOf(cell.B);
    const dutyC = topOf(cell.C);
    const utcMidday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    const byPerson: Record<string, PersonDayCell> = {};
    for (const { person } of persons) {
      const set = personDayShifts[person]?.[ymd];
      if (!set || set.size === 0) {
        byPerson[person] = {
          shifts: [],
          sharedShifts: [],
          label: "—",
          entries: 0,
          isDuty: false,
        };
        continue;
      }
      const shifts = shiftOrder.filter((s) => set.has(s));
      const sharedSet = personDaySharedShifts[person]?.[ymd];
      const sharedShifts = sharedSet ? shiftOrder.filter((s) => sharedSet.has(s)) : [];
      let entries = 0;
      for (const s of shifts) entries += cell[s][person] || 0;
      byPerson[person] = {
        shifts,
        sharedShifts,
        label: shifts.map((s) => s.toLowerCase()).join(","),
        entries,
        isDuty: true,
      };
    }

    const isToday = ymd === todayYmd;
    const isFuture = ymd > todayYmd;
    const coveredShifts = shiftOrder.filter((s) => Object.keys(cell[s]).length > 0);
    const upcomingShifts = shiftOrder.filter((s) => {
      if (Object.keys(cell[s]).length > 0) return false;
      if (isFuture) return true;
      if (isToday && todayHour < shiftStartHour[s]) return true;
      return false;
    });
    const missingShifts = shiftOrder.filter(
      (s) => !coveredShifts.includes(s) && !upcomingShifts.includes(s)
    );

    if (!isFuture) {
      elapsedDays++;
      filledShiftSlots += coveredShifts.length;
      totalShiftSlots += coveredShifts.length + missingShifts.length;
      if (dutyA.isTie) tiedShiftSlots++;
      if (dutyB.isTie) tiedShiftSlots++;
      if (dutyC.isTie) tiedShiftSlots++;
    }

    const unattr = dayUnattributed[ymd] || 0;
    const attributedEntries =
      Object.values(cell.A).reduce((s, n) => s + n, 0) +
      Object.values(cell.B).reduce((s, n) => s + n, 0) +
      Object.values(cell.C).reduce((s, n) => s + n, 0);

    days.push({
      day: d,
      ymd,
      dateLabel: utcMidday.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      weekday: utcMidday.toLocaleDateString("en-GB", {
        weekday: "short",
        timeZone: "UTC",
      }),
      isToday,
      isFuture,
      byPerson,
      A: dutyA,
      B: dutyB,
      C: dutyC,
      breakdown: {
        A: { ...cell.A },
        B: { ...cell.B },
        C: { ...cell.C },
      },
      coveredShifts,
      missingShifts,
      upcomingShifts,
      unattributedEntries: unattr,
      totalEntries: attributedEntries + unattr,
    });
  }

  const uncoveredShiftSlots = Math.max(0, totalShiftSlots - filledShiftSlots);
  const coveragePct =
    totalShiftSlots > 0 ? Math.round((filledShiftSlots / totalShiftSlots) * 100) : 0;

  const leaderboard = persons
    .filter((p) => p.shifts > 0)
    .map((p) => ({
      person: p.person,
      shifts: p.shifts,
      entries: p.entries,
    }));

  return {
    year: y,
    month: m,
    daysInMonth,
    todayYmd,
    classified,
    unattributed,
    skipped,
    coverage: {
      elapsedDays,
      totalShiftSlots,
      filledShiftSlots,
      uncoveredShiftSlots,
      tiedShiftSlots,
      coveragePct,
    },
    persons,
    days,
    leaderboard,
    shiftLeaders: {
      A: topOf(shiftLeaderTotals.A),
      B: topOf(shiftLeaderTotals.B),
      C: topOf(shiftLeaderTotals.C),
    },
    shifts: SHIFT_META,
  };
}

/** Inclusive month range in Dhaka: need prev day evening for C on day 1 and next morning for last day C */
export function monthQueryBounds(year: number, month: number): { from: string; to: string } {
  const y = Number(year);
  const m = Number(month);
  const startYmd = addDaysYmd(`${y}-${String(m).padStart(2, "0")}-01`, -1);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endYmd = addDaysYmd(
    `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    1
  );
  return { from: startYmd, to: endYmd };
}
