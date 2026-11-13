import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import ShiftMessage from "@/lib/models/ShiftMessage";
import { getMockStore, generateId } from "@/lib/mockStore";
import { dhakaNowParts, shiftFromHour, type ShiftId } from "@/lib/dutyShifts";

export const dynamic = "force-dynamic";

const SHIFT_ORDER: ShiftId[] = ["A", "B", "C"];

function nextShiftId(current: ShiftId): ShiftId {
  const idx = SHIFT_ORDER.indexOf(current);
  return SHIFT_ORDER[(idx + 1) % SHIFT_ORDER.length];
}

function currentShiftInfo(now = new Date()) {
  const parts = dhakaNowParts(now);
  const shift = shiftFromHour(parts.hour);
  let dutyDay = parts.ymd;
  if (shift === "C" && parts.hour <= 8) {
    const [y, m, d] = parts.ymd.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    dutyDay = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
  }
  return { shift, dutyDay };
}

function serializeMessage(doc: any) {
  if (!doc) return null;
  const id = doc._id?.toString?.() || doc.id || String(doc._id);
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
    acknowledgedBy: doc.acknowledgedBy?.toString?.() || doc.acknowledgedBy || null,
    acknowledgedByUsername: doc.acknowledgedByUsername || "",
    acknowledgedByDisplayName:
      doc.acknowledgedByDisplayName || doc.acknowledgedByUsername || "",
    acknowledgedAt: doc.acknowledgedAt || null,
    forwardedFrom: doc.forwardedFrom?.toString?.() || doc.forwardedFrom || null,
    forwardNote: doc.forwardNote || "",
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

/** POST — acknowledge + create a new pending message for the following shift */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const resolved = await params;
    const id = String(resolved?.id || "").trim();
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Message id is required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const forwardNote = String(body?.note || body?.forwardNote || "").trim().slice(0, 500);

    const admin = auth.admin;
    const username = admin?.username || admin?.displayName || "unknown";
    const displayName = admin?.displayName || admin?.username || username;
    const now = new Date();
    const info = currentShiftInfo(now);
    const targetShift = nextShiftId(info.shift);

    if (!isDbConnected()) {
      await connectDB();
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      const list = store.shiftMessages || [];
      const msg = list.find((m: any) => m.id === id || String(m._id) === id);
      if (!msg) {
        return NextResponse.json(
          { success: false, message: "Message not found" },
          { status: 404 }
        );
      }

      // mark original as forwarded
      msg.status = "forwarded";
      msg.acknowledgedBy = admin?.id || admin?._id || null;
      msg.acknowledgedByUsername = username;
      msg.acknowledgedByDisplayName = displayName;
      msg.acknowledgedAt = now.toISOString();
      msg.updatedAt = now.toISOString();
      if (forwardNote) msg.forwardNote = forwardNote;

      const originalContent = msg.content || "";
      const prefix = forwardNote
        ? `[Fwd from ${displayName} / ${info.shift}]: ${forwardNote}\n\n`
        : `[Fwd from ${displayName} / ${info.shift}]\n\n`;

      const newMsg = {
        id: generateId(),
        content: prefix + originalContent,
        createdBy: admin?.id || admin?._id || null,
        createdByUsername: username,
        createdByDisplayName: displayName,
        dutyDay: info.dutyDay,
        fromShift: info.shift,
        targetShift,
        status: "pending",
        acknowledgedBy: null,
        acknowledgedByUsername: "",
        acknowledgedByDisplayName: "",
        acknowledgedAt: null,
        forwardedFrom: msg.id,
        forwardNote,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      store.shiftMessages.unshift(newMsg);

      return NextResponse.json({
        success: true,
        message: serializeMessage(msg),
        forwardedMessage: serializeMessage(newMsg),
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Message not found" },
        { status: 404 }
      );
    }

    const doc = await ShiftMessage.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Message not found" },
        { status: 404 }
      );
    }

    doc.status = "forwarded";
    doc.acknowledgedBy = admin?.id || admin?._id || null;
    doc.acknowledgedByUsername = username;
    doc.acknowledgedByDisplayName = displayName;
    doc.acknowledgedAt = now;
    if (forwardNote) doc.forwardNote = forwardNote;
    await doc.save();

    const originalContent = doc.content || "";
    const prefix = forwardNote
      ? `[Fwd from ${displayName} / ${info.shift}]: ${forwardNote}\n\n`
      : `[Fwd from ${displayName} / ${info.shift}]\n\n`;

    const newDoc = await ShiftMessage.create({
      content: prefix + originalContent,
      createdBy: admin?.id || admin?._id || null,
      createdByUsername: username,
      createdByDisplayName: displayName,
      dutyDay: info.dutyDay,
      fromShift: info.shift,
      targetShift,
      status: "pending",
      forwardedFrom: doc._id,
      forwardNote,
    });

    return NextResponse.json({
      success: true,
      message: serializeMessage(doc.toObject()),
      forwardedMessage: serializeMessage(newDoc.toObject()),
    });
  } catch (err: any) {
    console.error("[station-notes forward]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to forward message" },
      { status: 500 }
    );
  }
}
