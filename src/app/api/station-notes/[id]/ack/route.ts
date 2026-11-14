import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";
import {
  appendReadReceipt,
  currentShiftInfo,
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
  const store = getStore();
  const note = store.stationNotes.find((n) => n.id === id);
  if (!note) {
    return NextResponse.json(
      { success: false, message: "Station note not found." },
      { status: 404 }
    );
  }

  const now = new Date();
  const shiftMeta = currentShiftInfo(now);
  const { receipts } = appendReadReceipt(
    note.readReceipts,
    auth.user,
    shiftMeta.shift,
    now
  );

  note.status = "acknowledged";
  note.acknowledgedBy = auth.user.id;
  note.acknowledgedByUsername = auth.user.username;
  note.acknowledgedByDisplayName = auth.user.displayName || auth.user.username;
  note.acknowledgedAt = now.toISOString();
  note.readReceipts = receipts;
  note.updatedAt = now.toISOString();

  return NextResponse.json({
    success: true,
    message: serializeStationNote(note),
    data: serializeStationNote(note),
  });
}
