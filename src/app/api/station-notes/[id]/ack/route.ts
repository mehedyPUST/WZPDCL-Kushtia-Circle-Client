import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import ShiftMessage from "@/lib/models/ShiftMessage";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

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
      if (msg.status !== "pending") {
        return NextResponse.json({
          success: true,
          message: serializeMessage(msg),
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
        message: serializeMessage(msg),
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

    if (doc.status !== "pending") {
      return NextResponse.json({
        success: true,
        message: serializeMessage(doc.toObject()),
        alreadyHandled: true,
      });
    }

    doc.status = "acknowledged";
    doc.acknowledgedBy = admin?.id || admin?._id || null;
    doc.acknowledgedByUsername = username;
    doc.acknowledgedByDisplayName = displayName;
    doc.acknowledgedAt = now;
    await doc.save();

    return NextResponse.json({
      success: true,
      message: serializeMessage(doc.toObject()),
    });
  } catch (err: any) {
    console.error("[station-notes ack]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to acknowledge" },
      { status: 500 }
    );
  }
}
