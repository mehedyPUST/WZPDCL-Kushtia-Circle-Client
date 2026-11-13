import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import ShiftMessage from "@/lib/models/ShiftMessage";
import { getMockStore, generateId } from "@/lib/mockStore";
import {
  appendReadReceipt,
  currentShiftInfo,
  nextShiftId,
  serializeStationNote,
} from "@/lib/stationNoteUtils";

export const dynamic = "force-dynamic";

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

      const { receipts } = appendReadReceipt(
        msg.readReceipts,
        admin,
        info.shift,
        now
      );
      msg.readReceipts = receipts;
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
        readReceipts: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      store.shiftMessages.unshift(newMsg);

      return NextResponse.json({
        success: true,
        message: serializeStationNote(msg),
        forwardedMessage: serializeStationNote(newMsg),
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

    const { receipts } = appendReadReceipt(
      doc.readReceipts,
      admin,
      info.shift,
      now
    );

    doc.status = "forwarded";
    doc.acknowledgedBy = admin?.id || admin?._id || null;
    doc.acknowledgedByUsername = username;
    doc.acknowledgedByDisplayName = displayName;
    doc.acknowledgedAt = now;
    doc.readReceipts = receipts;
    doc.markModified?.("readReceipts");
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
      readReceipts: [],
    });

    return NextResponse.json({
      success: true,
      message: serializeStationNote(doc.toObject()),
      forwardedMessage: serializeStationNote(newDoc.toObject()),
    });
  } catch (err: any) {
    console.error("[station-notes forward]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to forward message" },
      { status: 500 }
    );
  }
}
