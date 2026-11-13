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
  // C-shift early morning still belongs to previous duty day
  let dutyDay = parts.ymd;
  if (shift === "C" && parts.hour <= 8) {
    const [y, m, d] = parts.ymd.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    dutyDay = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
  }
  return { shift, dutyDay, hour: parts.hour, minute: parts.minute };
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
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return NextResponse.json({
        success: true,
        messages: list.slice(0, limit).map(serializeMessage),
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
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const pendingCount = await ShiftMessage.countDocuments({ status: "pending" });

    return NextResponse.json({
      success: true,
      messages: docs.slice(0, limit).map(serializeMessage),
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

    const payload = {
      content,
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
      forwardedFrom: null,
      forwardNote: "",
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
        message: serializeMessage(msg),
        currentShift: info.shift,
        nextShift: targetShift,
      });
    }

    const doc = await ShiftMessage.create(payload);
    return NextResponse.json({
      success: true,
      message: serializeMessage(doc.toObject ? doc.toObject() : doc),
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
