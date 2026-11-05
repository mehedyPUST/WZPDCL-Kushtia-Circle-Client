/**
 * Bottail SS operational shifts (local Asia/Dhaka clock):
 *   A — 09:00–14:xx
 *   B — 15:00–20:xx
 *   C — 21:00 → next day 08:xx
 *
 * C-shift entries between 00:00–08:59 belong to the *previous* duty day.
 */

export const SHIFT_META = {
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
 * Map alternate logins to one display identity.
 * admin and bottail.mehedy are the same person.
 */
const PERSON_ALIASES = {
  admin: "Mehedy",
  "bottail.mehedy": "Mehedy",
  mehedy: "Mehedy",
  "mehedy/admin": "Mehedy",
  "bottail.mehedy/admin": "Mehedy",
};

/**
 * Normalize a username / creator label for roster columns.
 * @param {string} raw
 * @returns {string}
 */
export function normalizePersonName(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "Unknown";
  const key = s.toLowerCase();
  if (PERSON_ALIASES[key]) return PERSON_ALIASES[key];
  // strip trailing role suffixes
  const noSlash = key.split("/")[0];
  if (PERSON_ALIASES[noSlash]) return PERSON_ALIASES[noSlash];
  // Title-case short names for display
  if (s === s.toLowerCase() && s.length <= 24 && !s.includes(".")) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

/** @returns {"A"|"B"|"C"} */
export function shiftFromHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return "A";
  if (h >= 9 && h <= 14) return "A";
  if (h >= 15 && h <= 20) return "B";
  return "C";
}

/**
 * Parse hour from hourSlot ("14:00", "18:30") or ISO date string in Dhaka.
 * @returns {{ hour: number, minute: number, ymd: string } | null}
 */
export function localPartsFromRecord(record) {
  const slot = record?.hourSlot && String(record.hourSlot).trim();
  const raw = record?.calculatedAt || record?.createdAt;
  let base = raw ? new Date(raw) : null;
  if (base && Number.isNaN(base.getTime())) base = null;

  let hour = null;
  let minute = 0;
  let ymd = null;

  if (slot && /^\d{1,2}:\d{2}$/.test(slot)) {
    const [hh, mm] = slot.split(":").map(Number);
    hour = hh;
    minute = mm || 0;
  }

  if (base) {
    try {
      ymd = base.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
      if (hour == null) {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(base);
        hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
        minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
      }
    } catch {
      /* ignore */
    }
  }

  if (hour == null) return null;
  if (!ymd && base) {
    ymd = base.toISOString().slice(0, 10);
  }
  if (!ymd) return null;

  return { hour, minute, ymd };
}

/** Add days to YYYY-MM-DD */
export function addDaysYmd(ymd, delta) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Map a calculation to duty calendar day + shift.
 * @returns {{ dutyDay: string, shift: "A"|"B"|"C", hour: number } | null}
 */
export function classifyDuty(record) {
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

/**
 * Aggregate calculations into monthly duty roster.
 * Primary layout: date × person matrix with shift letters (a / b / c).
 * @param {Array} records
 * @param {number} year
 * @param {number} month 1-12
 */
export function buildMonthlyDutyRoster(records, year, month) {
  const y = Number(year);
  const m = Number(month);
  const daysInMonth = new Date(y, m, 0).getDate();

  /** @type {Record<string, { A: Record<string, number>, B: Record<string, number>, C: Record<string, number> }>} */
  const byDay = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    byDay[ymd] = { A: {}, B: {}, C: {} };
  }

  /** person → dutyDay → Set of shifts */
  /** @type {Record<string, Record<string, Set<string>>>} */
  const personDayShifts = {};
  /** overall person counts in month */
  const personTotals = {};
  let classified = 0;
  let skipped = 0;

  for (const rec of records || []) {
    const c = classifyDuty(rec);
    if (!c) {
      skipped++;
      continue;
    }
    if (!byDay[c.dutyDay]) {
      skipped++;
      continue;
    }
    const who = normalizePersonName(
      (rec.createdByUsername && String(rec.createdByUsername).trim()) ||
        (rec.createdByDisplayName && String(rec.createdByDisplayName).trim()) ||
        (rec.createdBy && String(rec.createdBy)) ||
        "Unknown"
    );
    const bucket = byDay[c.dutyDay][c.shift];
    bucket[who] = (bucket[who] || 0) + 1;
    personTotals[who] = (personTotals[who] || 0) + 1;
    classified++;
  }

  function topOf(counts) {
    const entries = Object.entries(counts || {});
    if (entries.length === 0) {
      return { person: null, entries: 0, runnersUp: [], all: [] };
    }
    entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [person, n] = entries[0];
    return {
      person,
      entries: n,
      runnersUp: entries.slice(1, 4).map(([p, e]) => ({ person: p, entries: e })),
      all: entries.map(([p, e]) => ({ person: p, entries: e })),
    };
  }

  /**
   * Duty person for a shift = max entry count that day.
   * Only that person gets the shift letter in the matrix.
   */
  /** @type {Record<string, number>} duty shifts won this month */
  const personShiftCounts = {};
  for (const ymd of Object.keys(byDay)) {
    for (const sh of ["A", "B", "C"]) {
      const top = topOf(byDay[ymd][sh]);
      if (!top.person) continue;
      if (!personDayShifts[top.person]) personDayShifts[top.person] = {};
      if (!personDayShifts[top.person][ymd]) {
        personDayShifts[top.person][ymd] = new Set();
      }
      personDayShifts[top.person][ymd].add(sh);
      personShiftCounts[top.person] = (personShiftCounts[top.person] || 0) + 1;
    }
  }

  /** Column order: most duty shifts first (then raw entry volume) */
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

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cell = byDay[ymd];
    const dutyA = topOf(cell.A);
    const dutyB = topOf(cell.B);
    const dutyC = topOf(cell.C);

    /** @type {Record<string, { shifts: string[], label: string, entries: number, isDuty: boolean }>} */
    const byPerson = {};
    for (const { person } of persons) {
      const set = personDayShifts[person]?.[ymd];
      if (!set || set.size === 0) {
        byPerson[person] = {
          shifts: [],
          label: "—",
          entries: 0,
          isDuty: false,
        };
        continue;
      }
      const order = ["A", "B", "C"];
      const shifts = order.filter((s) => set.has(s));
      let entries = 0;
      for (const s of shifts) entries += cell[s][person] || 0;
      byPerson[person] = {
        shifts,
        label: shifts.map((s) => s.toLowerCase()).join(","),
        entries,
        isDuty: true,
      };
    }

    days.push({
      day: d,
      ymd,
      dateLabel: new Date(y, m - 1, d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      weekday: new Date(y, m - 1, d).toLocaleDateString("en-GB", {
        weekday: "short",
      }),
      byPerson,
      A: dutyA,
      B: dutyB,
      C: dutyC,
      totalEntries:
        Object.values(cell.A).reduce((s, n) => s + n, 0) +
        Object.values(cell.B).reduce((s, n) => s + n, 0) +
        Object.values(cell.C).reduce((s, n) => s + n, 0),
    });
  }

  /** Leaderboard ranks by duty shifts worked (not calculation entry count) */
  const leaderboard = persons
    .filter((p) => p.shifts > 0)
    .map((p) => ({
      person: p.person,
      shifts: p.shifts,
      entries: p.entries,
    }));

  /** Per-shift leaders: most duty days assigned to that shift letter */
  const shiftLeaders = { A: {}, B: {}, C: {} };
  for (const day of days) {
    for (const sh of ["A", "B", "C"]) {
      const dutyPerson = day[sh]?.person;
      if (!dutyPerson) continue;
      shiftLeaders[sh][dutyPerson] = (shiftLeaders[sh][dutyPerson] || 0) + 1;
    }
  }

  return {
    year: y,
    month: m,
    daysInMonth,
    classified,
    skipped,
    /** Column headers for matrix table */
    persons,
    days,
    leaderboard,
    shiftLeaders: {
      A: topOf(shiftLeaders.A),
      B: topOf(shiftLeaders.B),
      C: topOf(shiftLeaders.C),
    },
    shifts: SHIFT_META,
  };
}

/** Inclusive month range in Dhaka: need prev day evening for C on day 1 and next morning for last day C */
export function monthQueryBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  const startYmd = addDaysYmd(
    `${y}-${String(m).padStart(2, "0")}-01`,
    -1
  );
  const last = new Date(y, m, 0).getDate();
  const endYmd = addDaysYmd(
    `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    1
  );
  return { from: startYmd, to: endYmd };
}
