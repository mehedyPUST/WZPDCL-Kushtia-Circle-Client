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

      const { receipts, alreadyRead } = appendReadReceipt(
        msg.readReceipts,
        admin,
        info.shift,
        now
      );
      msg.readReceipts = receipts;
      if (!alreadyRead) {
        msg.updatedAt = now.toISOString();
      }

      return NextResponse.json({
        success: true,
        alreadyRead,
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

    if (!alreadyRead) {
      doc.readReceipts = receipts;
      doc.markModified?.("readReceipts");
      await doc.save();
    }

    return NextResponse.json({
      success: true,
      alreadyRead,
      message: serializeStationNote(doc.toObject()),
    });
  } catch (err: any) {
    console.error("[station-notes read]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to record read receipt" },
      { status: 500 }
    );
  }
}
