import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import OvertimeSheet from "@/lib/models/OvertimeSheet";
import { getMockStore, generateId } from "@/lib/mockStore";
import {
  currentDhakaYearMonth,
  defaultOvertimeSheet,
  generateOvertimeRows,
  normalizeDutyShift,
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
    extraDutyDates: Array.isArray(doc.extraDutyDates)
      ? doc.extraDutyDates.map((d: any) => String(d))
      : [],
    dutyShift: normalizeDutyShift(doc.dutyShift ?? "C"),
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
    extraDutyDates: sheet.extraDutyDates || [],
    dutyShift: sheet.dutyShift,
    purpose: sheet.purpose,
  });
  return {
    sheet,
    rows,
    totalHours: totalOvertimeHours(rows),
  };
}

function parseYmdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => String(d || "").trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

/** GET — load overtime sheet for current user + year/month (defaults to current Dhaka month) */
export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const dhaka = currentDhakaYearMonth();
    const year = parseInt(
      searchParams.get("year") || String(dhaka.year),
      10
    );
    const month = parseInt(
      searchParams.get("month") || String(dhaka.month),
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

    const payload = {
      userId,
      year,
      month,
      employeeName: String(body.employeeName || "").trim(),
      designation: String(body.designation || "SBA-A").trim() || "SBA-A",
      weeklyHoliday,
      clLeaveDates: parseYmdList(body.clLeaveDates),
      extraDutyDates: parseYmdList(body.extraDutyDates),
      dutyShift: normalizeDutyShift(body.dutyShift ?? "C"),
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
