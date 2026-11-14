/**
 * Bottail SS operates on Bangladesh Standard Time (Asia/Dhaka, UTC+6, no DST).
 * Production servers (Vercel / containers) run in UTC — calendar-day filters
 * MUST use this offset, not the server's local timezone.
 */

/** Fixed offset minutes east of UTC for Asia/Dhaka */
export const STATION_TZ_OFFSET_MINUTES = 6 * 60;

/**
 * Parse YYYY-MM-DD as a full calendar day in Asia/Dhaka → UTC [start, end).
 * @param {string} ymd
 * @returns {{ start: Date, end: Date } | null}
 */
export function dayBoundsFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;

  // Midnight Dhaka on calendar day = UTC midnight of that civil date minus 6h
  const startMs =
    Date.UTC(y, m - 1, d, 0, 0, 0, 0) - STATION_TZ_OFFSET_MINUTES * 60 * 1000;
  const endMs =
    Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) -
    STATION_TZ_OFFSET_MINUTES * 60 * 1000;

  const start = new Date(startMs);
  const end = new Date(endMs);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

/**
 * Calendar day key YYYY-MM-DD in Asia/Dhaka for an instant.
 * @param {string|Date|number} iso
 */
export function toStationDayKey(iso) {
  if (iso == null || iso === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Shift into Dhaka wall-clock, then read UTC components
  const shifted = new Date(
    d.getTime() + STATION_TZ_OFFSET_MINUTES * 60 * 1000
  );
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalize hour labels: "8:00" → "08:00", "9:30" → "09:30"
 */
export function normalizeHourSlot(label) {
  if (!label || typeof label !== "string") return "";
  const m = label.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return label.trim();
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}
