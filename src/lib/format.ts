/**
 * Display helpers — MW shown to 1 decimal with half-up rounding.
 * Internal calculations keep full precision; only presentation is rounded.
 */

/**
 * Round a number to `decimals` places (half-up, positive-oriented).
 * Uses a small epsilon so values like 1.25 don't drift under IEEE float.
 */
export function roundTo(value, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Format MW for UI / copy text: always 1 decimal place.
 * @example formatMW(12.34) → "12.3"
 * @example formatMW(12.35) → "12.4"
 * @example formatMW(0) → "0.0"
 * @example formatMW(null) → "—"
 */
export function formatMW(value, { empty = "—", decimals = 1 } = {}) {
  const r = roundTo(value, decimals);
  if (r == null) return empty;
  return r.toFixed(decimals);
}

/**
 * Same as formatMW but returns a number (or null) for further math/charts.
 */
export function mwNumber(value, decimals = 1) {
  return roundTo(value, decimals);
}
