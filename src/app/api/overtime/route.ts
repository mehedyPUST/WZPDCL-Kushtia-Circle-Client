import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import OvertimeSheet from "@/lib/models/OvertimeSheet";
import { getMockStore, generateId } from "@/lib/mockStore";
import {
  defaultOvertimeSheet,
  generateOvertimeRows,
  totalOvertimeHours,
  type OvertimeSheetRecord,
} from "@/lib/overtime";

export const dynamic = "force-dynamic";

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
    dutyFrom: String(doc.dutyFrom || "22:00"),
    dutyTo: String(doc.dutyTo || "06:00"),
    purpose: String(
      doc.purpose || "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়"
    ),
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt).toISOString()
      : null,
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : null,
  };
}

function withGenerated(sheet: OvertimeSheetRecord) {
  const rows = generateOvertimeRows({
    year: sheet.year,
    month: sheet.month,
    weeklyHoliday: sheet.weeklyHoliday,
    clLeaveDates: sheet.clLeaveDates,
    dutyFrom: sheet.dutyFrom,
    dutyTo: sheet.dutyTo,
    purpose: sheet.purpose,
  });
  return {
    sheet,
    rows,
    totalHours: totalOvertimeHours(rows),
  };
}

/** GET — load overtime sheet for current user + year/month */
export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(
      searchParams.get("year") || String(now.getFullYear()),
      10
    );
    const month = parseInt(
      searchParams.get("month") || String(now.getMonth() + 1),
      10
    );

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Invalid year or month" },
        { status: 400 }
      );
    }

    const userId = String(auth.admin!.id);

    if (!isDbConnected()) {
      await connectDB();
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      const list = store.overtimeSheets || [];
      const found = list.find(
        (s: any) =>
          String(s.userId) === userId &&
          Number(s.year) === year &&
          Number(s.month) === month
      );
      const sheet = found
        ? serializeDoc(found)
        : defaultOvertimeSheet(userId, year, month, {
            employeeName: auth.admin!.displayName || "",
          });
      return NextResponse.json({
        success: true,
        ...withGenerated(sheet),
      });
    }

    const doc = await OvertimeSheet.findOne({ userId, year, month }).lean();
    const sheet = doc
      ? serializeDoc(doc)
      : defaultOvertimeSheet(userId, year, month, {
          employeeName: auth.admin!.displayName || "",
        });

    return NextResponse.json({
      success: true,
      ...withGenerated(sheet),
    });
  } catch (err: any) {
    console.error("[overtime GET]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to load overtime data" },
      { status: 500 }
    );
  }
}

/** PUT — create or update overtime sheet for current user + year/month */
export async function PUT(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const year = Number(body.year);
    const month = Number(body.month);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Invalid year or month" },
        { status: 400 }
      );
    }

    const userId = String(auth.admin!.id);
    const weeklyHoliday = Math.min(
      6,
      Math.max(0, Number(body.weeklyHoliday ?? 0))
    );
    const clLeaveDates = Array.isArray(body.clLeaveDates)
      ? body.clLeaveDates
          .map((d: any) => String(d || "").trim())
          .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];

    const payload = {
      userId,
      year,
      month,
      employeeName: String(body.employeeName || "").trim(),
      designation: String(body.designation || "SBA-A").trim() || "SBA-A",
      weeklyHoliday,
      clLeaveDates,
      dutyFrom: String(body.dutyFrom || "22:00").trim() || "22:00",
      dutyTo: String(body.dutyTo || "06:00").trim() || "06:00",
      purpose:
        String(body.purpose || "").trim() ||
        "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়",
    };

    if (!isDbConnected()) {
      await connectDB();
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      if (!store.overtimeSheets) store.overtimeSheets = [];
      const idx = store.overtimeSheets.findIndex(
        (s: any) =>
          String(s.userId) === userId &&
          Number(s.year) === year &&
          Number(s.month) === month
      );
      const now = new Date().toISOString();
      if (idx >= 0) {
        store.overtimeSheets[idx] = {
          ...store.overtimeSheets[idx],
          ...payload,
          updatedAt: now,
        };
      } else {
        store.overtimeSheets.push({
          id: generateId(),
          ...payload,
          createdAt: now,
          updatedAt: now,
        });
      }
      const saved = store.overtimeSheets.find(
        (s: any) =>
          String(s.userId) === userId &&
          Number(s.year) === year &&
          Number(s.month) === month
      );
      return NextResponse.json({
        success: true,
        message: "Overtime data saved",
        ...withGenerated(serializeDoc(saved)),
      });
    }

    const doc = await OvertimeSheet.findOneAndUpdate(
      { userId, year, month },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: "Overtime data saved",
      ...withGenerated(serializeDoc(doc)),
    });
  } catch (err: any) {
    console.error("[overtime PUT]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to save overtime data" },
      { status: 500 }
    );
  }
}
