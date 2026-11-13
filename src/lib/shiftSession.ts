/**
 * Shift-boundary session policy for Bottail SS duty accountability.
 *
 * Admin and Duty operators are automatically logged out at:
 *   08:30, 14:30, and 20:30 every day (Asia/Dhaka, UTC+6)
 * so each incoming shift signs in with their own account.
 *
 * Circle-load-input and viewer accounts are exempt from scheduled logout.
 */

export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
export const STANDARD_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Cutoffs in minutes from Dhaka midnight: 08:30, 14:30, 20:30 */
export const SHIFT_CUTOFF_MINUTES = [
  8 * 60 + 30,
  14 * 60 + 30,
  20 * 60 + 30,
] as const;

export type NormalizedRole = "admin" | "duty" | "circle-load-input" | "viewer";

export function normalizeAuthRole(role: unknown): NormalizedRole {
  const r = String(role || "")
    .toLowerCase()
    .replace(/_/g, "-");
  if (r === "admin" || r === "superadmin") return "admin";
  if (r === "duty" || r === "duty-person" || r === "operator") return "duty";
  if (
    r === "circle-load-input" ||
    r === "circleloadinput" ||
    r === "circle-input"
  ) {
    return "circle-load-input";
  }
  return "viewer";
}

/**
 * Only admin and duty roles are subject to 08:30 / 14:30 / 20:30 BST auto-logout.
 * Circle-load-input and viewer accounts stay signed in.
 */
export function isShiftAutoLogoutRole(role: unknown): boolean {
  const norm = normalizeAuthRole(role);
  return norm === "admin" || norm === "duty";
}

/**
 * Returns the UTC epoch ms of the next 08:30, 14:30, or 20:30 Asia/Dhaka cutoff
 * strictly after `fromMs`.
 */
export function getNextShiftCutoffMs(fromMs: number = Date.now()): number {
  const base = Number.isFinite(fromMs) ? fromMs : Date.now();
  const dhaka = new Date(base + DHAKA_OFFSET_MS);
  const y = dhaka.getUTCFullYear();
  const m = dhaka.getUTCMonth();
  const d = dhaka.getUTCDate();

  const candidates: number[] = [];
  for (const dayOffset of [0, 1]) {
    for (const mins of SHIFT_CUTOFF_MINUTES) {
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      const utcMs = Date.UTC(y, m, d + dayOffset, hh, mm, 0, 0) - DHAKA_OFFSET_MS;
      candidates.push(utcMs);
    }
  }

  for (const ts of candidates) {
    if (ts > base) return ts;
  }
  return candidates[candidates.length - 1];
}

export function formatDhakaCutoffHM(utcMs: number | null | undefined): string {
  if (!utcMs || !Number.isFinite(Number(utcMs))) return "";
  const dhaka = new Date(Number(utcMs) + DHAKA_OFFSET_MS);
  const hh = String(dhaka.getUTCHours()).padStart(2, "0");
  const mm = String(dhaka.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function computeSessionExpiry(
  role: unknown,
  fromMs: number = Date.now(),
  preserveCutoffMs?: number | null
): { shiftLogoutAt: number | null; ttlSeconds: number } {
  if (!isShiftAutoLogoutRole(role)) {
    return {
      shiftLogoutAt: null,
      ttlSeconds: STANDARD_SESSION_TTL_SECONDS,
    };
  }

  const cutoff =
    preserveCutoffMs && Number.isFinite(preserveCutoffMs) && preserveCutoffMs > fromMs
      ? preserveCutoffMs
      : getNextShiftCutoffMs(fromMs);

  const ttlSeconds = Math.max(1, Math.ceil((cutoff - fromMs) / 1000));
  return {
    shiftLogoutAt: cutoff,
    ttlSeconds,
  };
}
