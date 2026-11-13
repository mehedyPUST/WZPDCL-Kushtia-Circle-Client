import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import ShiftMessage from "@/lib/models/ShiftMessage";
import { getMockStore } from "@/lib/mockStore";
import {
  appendReadReceipt,
  currentShiftInfo,
  serializeStationNote,
} from "@/lib/stationNoteUtils";

export const dynamic = "force-dynamic";

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

    const admin = auth.admin;
    const username = admin?.username || admin?.displayName || "unknown";
    const displayName = admin?.displayName || admin?.username || username;
    const now = new Date();
    const info = currentShiftInfo(now);

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

      if (msg.status !== "pending") {
        msg.updatedAt = now.toISOString();
        return NextResponse.json({
          success: true,
          message: serializeStationNote(msg),
          alreadyHandled: true,
        });
      }

      msg.status = "acknowledged";
      msg.acknowledgedBy = admin?.id || admin?._id || null;
      msg.acknowledgedByUsername = username;
      msg.acknowledgedByDisplayName = displayName;
      msg.acknowledgedAt = now.toISOString();
      msg.updatedAt = now.toISOString();
      return NextResponse.json({
        success: true,
        message: serializeStationNote(msg),
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

    const { receipts, alreadyRead } = appendReadReceipt(
      doc.readReceipts,
      admin,
      info.shift,
      now
    );

    if (doc.status !== "pending") {
      if (!alreadyRead) {
        doc.readReceipts = receipts;
        doc.markModified?.("readReceipts");
        await doc.save();
      }
      return NextResponse.json({
        success: true,
        message: serializeStationNote(doc.toObject()),
        alreadyHandled: true,
      });
    }

    doc.status = "acknowledged";
    doc.acknowledgedBy = admin?.id || admin?._id || null;
    doc.acknowledgedByUsername = username;
    doc.acknowledgedByDisplayName = displayName;
    doc.acknowledgedAt = now;
    doc.readReceipts = receipts;
    doc.markModified?.("readReceipts");
    await doc.save();

    return NextResponse.json({
      success: true,
      message: serializeStationNote(doc.toObject()),
    });
  } catch (err: any) {
    console.error("[station-notes ack]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to acknowledge" },
      { status: 500 }
    );
  }
}
