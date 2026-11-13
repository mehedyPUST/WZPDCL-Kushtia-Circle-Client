import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import ShiftMessage from "@/lib/models/ShiftMessage";
import { getMockStore, generateId } from "@/lib/mockStore";
import {
  currentShiftInfo,
  nextShiftId,
  normalizePriority,
  serializeStationNote,
} from "@/lib/stationNoteUtils";

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 2,
  high: 1,
  normal: 0,
};

export const dynamic = "force-dynamic";

/** GET — list recent station notes (pending first) */
export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "").toLowerCase();
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "30", 10) || 30));

    const info = currentShiftInfo();

    if (!isDbConnected()) {
      await connectDB();
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      let list = [...(store.shiftMessages || [])];
      if (status === "pending") {
        list = list.filter((m) => m.status === "pending");
      } else if (status === "acknowledged") {
        list = list.filter((m) => m.status === "acknowledged" || m.status === "forwarded");
      }
      list.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        if (a.status === "pending" && b.status === "pending") {
          const pw =
            (PRIORITY_WEIGHT[normalizePriority(b.priority)] ?? 0) -
            (PRIORITY_WEIGHT[normalizePriority(a.priority)] ?? 0);
          if (pw !== 0) return pw;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return NextResponse.json({
        success: true,
        messages: list.slice(0, limit).map(serializeStationNote),
        currentShift: info.shift,
        dutyDay: info.dutyDay,
        nextShift: nextShiftId(info.shift),
        pendingCount: list.filter((m) => m.status === "pending").length,
      });
    }

    const filter: any = {};
    if (status === "pending") filter.status = "pending";
    else if (status === "acknowledged") filter.status = { $in: ["acknowledged", "forwarded"] };

    const docs = await ShiftMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.max(limit * 2, 60))
      .lean();

    docs.sort((a: any, b: any) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      if (a.status === "pending" && b.status === "pending") {
        const pw =
          (PRIORITY_WEIGHT[normalizePriority(b.priority)] ?? 0) -
          (PRIORITY_WEIGHT[normalizePriority(a.priority)] ?? 0);
        if (pw !== 0) return pw;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const pendingCount = await ShiftMessage.countDocuments({ status: "pending" });

    return NextResponse.json({
      success: true,
      messages: docs.slice(0, limit).map(serializeStationNote),
      currentShift: info.shift,
      dutyDay: info.dutyDay,
      nextShift: nextShiftId(info.shift),
      pendingCount,
    });
  } catch (err: any) {
    console.error("[station-notes GET]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to load messages" },
      { status: 500 }
    );
  }
}

/** POST — leave a message for the next shift */
export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const content = String(body?.content || "").trim();
    if (!content) {
      return NextResponse.json(
        { success: false, message: "Message content is required" },
        { status: 400 }
      );
    }
    if (content.length > 2000) {
      return NextResponse.json(
        { success: false, message: "Message is too long (max 2000 chars)" },
        { status: 400 }
      );
    }

    const info = currentShiftInfo();
    const targetShift = body?.targetShift
      ? String(body.targetShift).toUpperCase()
      : nextShiftId(info.shift);

    if (!["A", "B", "C"].includes(targetShift)) {
      return NextResponse.json(
        { success: false, message: "Invalid target shift" },
        { status: 400 }
      );
    }

    const admin = auth.admin;
    const username = admin?.username || admin?.displayName || "unknown";
    const displayName = admin?.displayName || admin?.username || username;
    const priority = normalizePriority(body?.priority);

    const payload = {
      content,
      createdBy: admin?.id || admin?._id || null,
      createdByUsername: username,
      createdByDisplayName: displayName,
      dutyDay: info.dutyDay,
      fromShift: info.shift,
      targetShift,
      status: "pending",
      priority,
      acknowledgedBy: null,
      acknowledgedByUsername: "",
      acknowledgedByDisplayName: "",
      acknowledgedAt: null,
      forwardedFrom: null,
      forwardNote: "",
      readReceipts: [],
    };

    if (!isDbConnected()) {
      await connectDB();
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      const now = new Date().toISOString();
      const msg = {
        id: generateId(),
        ...payload,
        createdAt: now,
        updatedAt: now,
      };
      store.shiftMessages = store.shiftMessages || [];
      store.shiftMessages.unshift(msg);
      return NextResponse.json({
        success: true,
        message: serializeStationNote(msg),
        currentShift: info.shift,
        nextShift: targetShift,
      });
    }

    const doc = await ShiftMessage.create(payload);
    return NextResponse.json({
      success: true,
      message: serializeStationNote(doc.toObject ? doc.toObject() : doc),
      currentShift: info.shift,
      nextShift: targetShift,
    });
  } catch (err: any) {
    console.error("[station-notes POST]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to save message" },
      { status: 500 }
    );
  }
}
