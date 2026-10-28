/**
 * Hourly save slots for load readings.
 * - Every full hour: 00:00 … 23:00
 * - Special half-hours: 18:30, 19:30
 */

export const SPECIAL_SLOTS = ["18:30", "19:30"];

/** Max minutes from a slot to still treat it as "nearest / allowed" */
export const SLOT_WINDOW_MINUTES = 25;

/**
 * @param {Date} [now]
 * @returns {{ label: string, hour: number, minute: number, date: Date, minutesAway: number, isSpecial: boolean }}
 */
export function getNearestHourSlot(now = new Date()) {
  const base = new Date(now);
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();

  /** @type {{ label: string, hour: number, minute: number, date: Date, isSpecial: boolean }[]} */
  const candidates = [];

  // Today full hours + yesterday 23:00 + tomorrow 00:00 (edge of day)
  for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
    const day = new Date(y, m, d + dayOffset);
    for (let h = 0; h < 24; h++) {
      candidates.push({
        label: `${String(h).padStart(2, "0")}:00`,
        hour: h,
        minute: 0,
        date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0),
        isSpecial: false,
      });
    }
    // Special half-hours
    for (const sp of SPECIAL_SLOTS) {
      const [hh, mm] = sp.split(":").map(Number);
      candidates.push({
        label: sp,
        hour: hh,
        minute: mm,
        date: new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          hh,
          mm,
          0,
          0
        ),
        isSpecial: true,
      });
    }
  }

  let best = candidates[0];
  let bestDiff = Math.abs(base.getTime() - best.date.getTime());

  for (let i = 1; i < candidates.length; i++) {
    const diff = Math.abs(base.getTime() - candidates[i].date.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidates[i];
    }
  }

  const minutesAway = Math.round(bestDiff / 60000);

  return {
    label: best.label,
    hour: best.hour,
    minute: best.minute,
    date: best.date,
    minutesAway,
    isSpecial: best.isSpecial,
    withinWindow: minutesAway <= SLOT_WINDOW_MINUTES,
  };
}

/**
 * Format slot for display / DB: "HH:mm"
 * @param {{ label: string }} slot
 */
export function formatSlotLabel(slot) {
  return slot?.label || "—";
}
