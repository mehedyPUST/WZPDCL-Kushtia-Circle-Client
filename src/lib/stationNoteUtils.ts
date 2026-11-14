import { dhakaNowParts, shiftFromHour, type ShiftId } from "@/lib/dutyShifts";
export interface AuthAdmin {
  id?: string;
  _id?: string;
  username?: string;
  displayName?: string;
}

export const SHIFT_ORDER: ShiftId[] = ["A", "B", "C"];

export type StationNotePriority = "normal" | "high" | "critical";

export function normalizePriority(value: unknown): StationNotePriority {
  const v = String(value || "").trim().toLowerCase();
  if (v === "critical" || v === "urgent") return "critical";
  if (v === "high") return "high";
  return "normal";
}

export function nextShiftId(current: ShiftId): ShiftId {
  const idx = SHIFT_ORDER.indexOf(current);
  return SHIFT_ORDER[(idx + 1) % SHIFT_ORDER.length];
}

export function currentShiftInfo(now = new Date()) {
  const parts = dhakaNowParts(now);
  const shift = shiftFromHour(parts.hour);
  // C-shift early morning still belongs to previous duty day
  let dutyDay = parts.ymd;
  if (shift === "C" && parts.hour <= 8) {
    const [y, m, d] = parts.ymd.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    dutyDay = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
  }
  return { shift, dutyDay, hour: parts.hour, minute: parts.minute };
}

export interface SerializedReadReceipt {
  userId: string | null;
  username: string;
  displayName: string;
  shift: string;
  readAt: string | null;
}

export function appendReadReceipt(
  existing: any[] | undefined,
  admin: AuthAdmin | undefined,
  shift: string,
  now: Date
) {
  const list = Array.isArray(existing) ? [...existing] : [];
  const userId = admin?.id || admin?._id || null;
  const username = String(admin?.username || admin?.displayName || "unknown").trim();
  const displayName = String(admin?.displayName || admin?.username || username).trim();
  const nowIso = now.toISOString();

  const alreadyIdx = list.findIndex((r: any) => {
    const rUid = r?.userId?.toString?.() || (typeof r?.userId === "string" ? r.userId : null);
    if (userId && rUid && String(rUid) === String(userId)) return true;
    if (username && r?.username && String(r.username).toLowerCase() === username.toLowerCase()) {
      return true;
    }
    return false;
  });

  if (alreadyIdx >= 0) {
    return { receipts: list, alreadyRead: true };
  }

  list.push({
    userId,
    username,
    displayName,
    shift: ["A", "B", "C"].includes(shift) ? shift : "",
    readAt: nowIso,
  });

  return { receipts: list, alreadyRead: false };
}

export function serializeStationNote(doc: any) {
  if (!doc) return null;
  const id = doc._id?.toString?.() || doc.id || String(doc._id);
  const rawReceipts = Array.isArray(doc.readReceipts) ? doc.readReceipts : [];

  const readReceipts: SerializedReadReceipt[] = rawReceipts.map((r: any) => ({
    userId: r?.userId?.toString?.() || r?.userId || null,
    username: r?.username || "",
    displayName: r?.displayName || r?.username || "Operator",
    shift: r?.shift || "",
    readAt: r?.readAt || null,
  }));

  // Ensure legacy acknowledged records without readReceipts still show the acknowledging SBA as a reader
  if (
    readReceipts.length === 0 &&
    doc.acknowledgedByDisplayName &&
    (doc.status === "acknowledged" || doc.status === "forwarded")
  ) {
    readReceipts.push({
      userId: doc.acknowledgedBy?.toString?.() || doc.acknowledgedBy || null,
      username: doc.acknowledgedByUsername || "",
      displayName: doc.acknowledgedByDisplayName || doc.acknowledgedByUsername || "",
      shift: "",
      readAt: doc.acknowledgedAt || null,
    });
  }

  return {
    id,
    content: doc.content || "",
    createdBy: doc.createdBy?.toString?.() || doc.createdBy || null,
    createdByUsername: doc.createdByUsername || "",
    createdByDisplayName: doc.createdByDisplayName || doc.createdByUsername || "",
    dutyDay: doc.dutyDay || "",
    fromShift: doc.fromShift || "",
    targetShift: doc.targetShift || "",
    status: doc.status || "pending",
    priority: normalizePriority(doc.priority),
    acknowledgedBy: doc.acknowledgedBy?.toString?.() || doc.acknowledgedBy || null,
    acknowledgedByUsername: doc.acknowledgedByUsername || "",
    acknowledgedByDisplayName:
      doc.acknowledgedByDisplayName || doc.acknowledgedByUsername || "",
    acknowledgedAt: doc.acknowledgedAt || null,
    forwardedFrom: doc.forwardedFrom?.toString?.() || doc.forwardedFrom || null,
    forwardNote: doc.forwardNote || "",
    readReceipts,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}
