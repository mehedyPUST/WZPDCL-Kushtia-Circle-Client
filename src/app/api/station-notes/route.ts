import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";
import {
  currentShiftInfo,
  nextShiftId,
  normalizePriority,
  serializeStationNote,
} from "@/lib/stationNoteUtils";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));

  const store = getStore();
  const shiftMeta = currentShiftInfo();
  const nextShift = nextShiftId(shiftMeta.shift);

  const sorted = [...store.stationNotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const pendingCount = sorted.filter((n) => n.status === "pending").length;
  const filtered = status ? sorted.filter((n) => n.status === status) : sorted;

  return NextResponse.json({
    success: true,
    messages: filtered.slice(0, limit).map(serializeStationNote),
    pendingCount,
    currentShift: shiftMeta.shift,
    nextShift,
    dutyDay: shiftMeta.dutyDay,
  });
}

export async function POST(req: NextRequest) {
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

  if (auth.user.role !== "admin" && auth.user.role !== "duty") {
    return NextResponse.json(
      { success: false, message: "Only Duty or Admin users can post station notes." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content || "").trim();
  if (!content) {
    return NextResponse.json(
      { success: false, message: "Note content is required." },
      { status: 400 }
    );
  }

  const shiftMeta = currentShiftInfo();
  const nextShift = nextShiftId(shiftMeta.shift);
  const targetShift = ["A", "B", "C"].includes(String(body.targetShift || ""))
    ? String(body.targetShift)
    : nextShift;
  const priority = normalizePriority(body.priority);
  const nowIso = new Date().toISOString();

  const note = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    content,
    createdBy: auth.user.id,
    createdByUsername: auth.user.username,
    createdByDisplayName: auth.user.displayName || auth.user.username,
    dutyDay: shiftMeta.dutyDay,
    fromShift: shiftMeta.shift,
    targetShift,
    status: "pending" as const,
    priority,
    acknowledgedBy: null,
    acknowledgedByUsername: "",
    acknowledgedByDisplayName: "",
    acknowledgedAt: null,
    forwardedFrom: null,
    forwardNote: "",
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

  const store = getStore();
  store.stationNotes.unshift(note);

  return NextResponse.json({
    success: true,
    message: serializeStationNote(note),
    data: serializeStationNote(note),
  });
}
