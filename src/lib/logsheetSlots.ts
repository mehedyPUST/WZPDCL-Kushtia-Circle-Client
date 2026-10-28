import { getNearestHourSlot } from "./hourSlot";

/**
 * 26 daily logsheet slots: 00:00–23:00 plus special 18:30 and 19:30
 * Chronological order for the day view.
 */
export const LOGSHEET_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    const label = `${String(h).padStart(2, "0")}:00`;
    slots.push({ label, hour: h, minute: 0, isSpecial: false });
    if (h === 18) {
      slots.push({ label: "18:30", hour: 18, minute: 30, isSpecial: true });
    }
    if (h === 19) {
      slots.push({ label: "19:30", hour: 19, minute: 30, isSpecial: true });
    }
  }
  return slots;
})();

/**
 * Calendar day key YYYY-MM-DD in Asia/Dhaka (station time).
 * Use this everywhere so production (UTC host) and browser agree.
 */
export function toDayKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka
  const shifted = new Date(d.getTime() + OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeHourSlot(label) {
  if (!label || typeof label !== "string") return "";
  const m = label.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return label.trim();
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

/**
 * Map a record to a slot label using hourSlot, or nearest slot from timestamp.
 * Examples: 08:49 → 09:00, 09:10 → 09:00 (true nearest among 26 slots).
 */
export function recordSlotLabel(record) {
  if (record?.hourSlot && typeof record.hourSlot === "string") {
    const s = normalizeHourSlot(record.hourSlot);
    if (s) return s;
  }
  const iso = record?.calculatedAt || record?.createdAt;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return getNearestHourSlot(d).label;
}

export function formatDayLabel(dayKey) {
  if (!dayKey) return "—";
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
