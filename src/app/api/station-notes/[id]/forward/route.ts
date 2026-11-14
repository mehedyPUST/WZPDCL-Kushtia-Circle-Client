import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";
import {
  appendReadReceipt,
  currentShiftInfo,
  nextShiftId,
  serializeStationNote,
} from "@/lib/stationNoteUtils";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(req);
  if (!auth.user) {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication required",
        code: auth.reason === "shift_cutoff" ? "SHIFT_CUTOFF" : "UNAUTHORIZED",
        cutoffAt: auth.cutoffAt ?? null,
      },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const forwardNoteText = String(body.note || "").trim();

  const store = getStore();
  const orig = store.stationNotes.find((n) => n.id === id);
  if (!orig) {
    return NextResponse.json(
      { success: false, message: "Station note not found." },
      { status: 404 }
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const shiftMeta = currentShiftInfo(now);
  const { receipts } = appendReadReceipt(
    orig.readReceipts,
    auth.user,
    shiftMeta.shift,
    now
  );

  orig.status = "forwarded";
  orig.forwardNote = forwardNoteText;
  orig.readReceipts = receipts;
  orig.updatedAt = nowIso;

  const forwardedCopy = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    content: forwardNoteText
      ? `${orig.content}\n[Forwarded note: ${forwardNoteText}]`
      : orig.content,
    createdBy: auth.user.id,
    createdByUsername: auth.user.username,
    createdByDisplayName: auth.user.displayName || auth.user.username,
    dutyDay: shiftMeta.dutyDay,
    fromShift: shiftMeta.shift,
    targetShift: nextShiftId(shiftMeta.shift),
    status: "pending" as const,
    priority: orig.priority,
    acknowledgedBy: null,
    acknowledgedByUsername: "",
    acknowledgedByDisplayName: "",
    acknowledgedAt: null,
    forwardedFrom: orig.id,
    forwardNote: forwardNoteText,
    readReceipts: [
      {
        userId: auth.user.id,
        username: auth.user.username,
        displayName: auth.user.displayName || auth.user.username,
        shift: shiftMeta.shift,
        readAt: nowIso,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.stationNotes.unshift(forwardedCopy);

  return NextResponse.json({
    success: true,
    message: serializeStationNote(orig),
    forwarded: serializeStationNote(forwardedCopy),
    data: serializeStationNote(orig),
  });
}
