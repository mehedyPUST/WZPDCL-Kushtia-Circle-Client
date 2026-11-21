import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import OvertimeSheet from "@/lib/models/OvertimeSheet";
import { getMockStore } from "@/lib/mockStore";
import { listAllUsers } from "@/lib/userStore";
import {
  currentDhakaYearMonth,
  defaultOvertimeSheet,
  normalizeDutyShift,
  type ExtraDutyEntry,
  type OvertimeSheetRecord,
} from "@/lib/overtime";

export const dynamic = "force-dynamic";

const DEFAULT_PURPOSE = "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়";

function parseExtraEntries(raw: unknown): ExtraDutyEntry[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, ExtraDutyEntry>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const date = String((item as any).date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    map.set(date, {
      date,
      normalFrom: String((item as any).normalFrom || "").trim(),
      normalTo: String((item as any).normalTo || "").trim(),
      dutyFrom: String((item as any).dutyFrom || "22:00").trim() || "22:00",
      dutyTo: String((item as any).dutyTo || "06:00").trim() || "06:00",
      purpose: String((item as any).purpose || "").trim() || DEFAULT_PURPOSE,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function serializeDoc(doc: any): OvertimeSheetRecord {
  return {
    id: String(doc._id || doc.id || ""),
    userId: String(doc.userId || ""),
    year: Number(doc.year),
    month: Number(doc.month),
    employeeName: String(doc.employeeName || ""),
    designation: String(doc.designation || "SBA-A"),
    weeklyHoliday: Number(doc.weeklyHoliday ?? 0),
    clLeaveDates: Array.isArray(doc.clLeaveDates)
      ? doc.clLeaveDates.map((d: any) => String(d))
      : [],
    excludedDates: Array.isArray(doc.excludedDates)
      ? doc.excludedDates.map((d: any) => String(d))
      : [],
    extraDutyEntries: parseExtraEntries(doc.extraDutyEntries),
    dutyShift: normalizeDutyShift(doc.dutyShift ?? "C"),
    purpose: String(doc.purpose || DEFAULT_PURPOSE),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const requesterRole = String(auth.admin?.role || "").toLowerCase();
  if (requesterRole !== "duty" && requesterRole !== "admin") {
    return NextResponse.json(
      { success: false, message: "Duty or admin access required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const dhaka = currentDhakaYearMonth();
    const year = parseInt(searchParams.get("year") || String(dhaka.year), 10);
    const month = parseInt(searchParams.get("month") || String(dhaka.month), 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Invalid year or month" },
        { status: 400 }
      );
    }

    await connectDB();
    const allUsers = await listAllUsers();
    const dutyUsers = allUsers
      .filter((u) => u.isActive !== false && u.role === "duty")
      .sort((a, b) =>
        (a.displayName || a.username).localeCompare(b.displayName || b.username)
      );

    let sheetDocs: any[] = [];
    if (!isDbConnected()) {
      const store = getMockStore();
      sheetDocs = (store.overtimeSheets || []).filter(
        (s: any) => Number(s.year) === year && Number(s.month) === month
      );
    } else {
      sheetDocs = await OvertimeSheet.find({ year, month }).lean();
    }

    const byUserId = new Map<string, OvertimeSheetRecord>();
    for (const doc of sheetDocs) {
      const serialized = serializeDoc(doc);
      if (serialized.userId) {
        byUserId.set(serialized.userId, serialized);
      }
    }

    const items = dutyUsers.map((u) => {
      const existing = byUserId.get(u.id);
      const sheet =
        existing ||
        defaultOvertimeSheet(u.id, year, month, {
          employeeName: u.displayName || u.username,
        });
      return {
        userId: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        role: u.role,
        assignedStation: u.assignedStation || "",
        hasSheet: Boolean(existing),
        sheet,
        updatedAt: existing?.updatedAt || null,
      };
    });

    return NextResponse.json({
      success: true,
      year,
      month,
      total: items.length,
      items,
    });
  } catch (err: any) {
    console.error("[overtime/all GET]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to load team overtime sheets" },
      { status: 500 }
    );
  }
}
