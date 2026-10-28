/**
 * Shared sheet table column widths (Manual, Load Shed, Logsheet, History).
 * All data columns (Time, feeders, totals, …) share COL_W.
 * SN is exactly 0.75 × COL_W.
 */
export const COL_W = 56;
export const SN_W = Math.round(COL_W * 0.75); // 42
/** @deprecated alias */
export const TIME_W = COL_W;

export const colStyle = {
  width: COL_W,
  minWidth: COL_W,
  maxWidth: COL_W,
};

export const snStyle = {
  width: SN_W,
  minWidth: SN_W,
  maxWidth: SN_W,
};
