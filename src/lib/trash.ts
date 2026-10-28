import Calculation from "@/lib/models/Calculation";
import Settings from "@/lib/models/Settings";
import { isDbConnected } from "@/lib/db";
import { getMockStore } from "@/lib/mockStore";

/** Default retention when settings missing */
export const TRASH_RETENTION_DAYS = 30;

/**
 * Permanently remove soft-deleted records older than trashRetentionDays.
 */
export async function purgeExpiredTrash() {
  try {
    if (!isDbConnected()) {
      const store = getMockStore();
      const days = Number(store.settings?.trashRetentionDays);
      const retentionDays =
        Number.isFinite(days) && days > 0 ? days : TRASH_RETENTION_DAYS;
      const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const before = store.calculations.length;
      store.calculations = store.calculations.filter((doc) => {
        if (!doc.deletedAt) return true;
        const t = new Date(doc.deletedAt).getTime();
        return Number.isNaN(t) || t >= cutoffMs;
      });
      return before - store.calculations.length;
    }

    const doc = await Settings.findOne({ key: "app" })
      .select("trashRetentionDays")
      .lean();
    const days = Number(doc?.trashRetentionDays);
    const retentionDays =
      Number.isFinite(days) && days > 0 ? days : TRASH_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await Calculation.deleteMany({
      deletedAt: { $ne: null, $lt: cutoff },
    });
    return result.deletedCount || 0;
  } catch (err) {
    console.error("purgeExpiredTrash:", err?.message || err);
    return 0;
  }
}

/** Days remaining before auto-purge (null if unknown) */
export function daysLeftInTrash(deletedAt, retentionDays = TRASH_RETENTION_DAYS) {
  if (!deletedAt) return null;
  const deleted = new Date(deletedAt).getTime();
  if (Number.isNaN(deleted)) return null;
  const days =
    Number.isFinite(retentionDays) && retentionDays > 0
      ? retentionDays
      : TRASH_RETENTION_DAYS;
  const expires = deleted + days * 24 * 60 * 60 * 1000;
  const left = Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000));
  return left > 0 ? left : 0;
}
