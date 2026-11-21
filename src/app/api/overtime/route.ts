import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import OvertimeSheet from "@/lib/models/OvertimeSheet";
import { getMockStore, generateId } from "@/lib/mockStore";
import {
  currentDhakaYearMonth,
  defaultOvertimeSheet,
  normalizeDutyShift,
  type ExtraDutyEntry,
  type OvertimeSheetRecord,
} from "@/lib/overtime";

export const dynamic = "force-dynamic";

const DEFAULT_PURPOSE = "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়";

function parseYmdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => String(d || "").trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

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

  try {
    const { searchParams } = new URL(request.url);
    const dhaka = currentDhakaYearMonth();
    const year = parseInt(searchParams.get("year") || String(dhaka.year), 10);
    const month = parseInt(searchParams.get("month") || String(dhaka.month), 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ success: false, message: "Invalid year or month" }, { status: 400 });
    }

    const userId = String(auth.admin!.id);
    if (!isDbConnected()) await connectDB();

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
      return NextResponse.json({ success: true, sheet });
    }

    const doc = await OvertimeSheet.findOne({ userId, year, month }).lean();
    const sheet = doc
      ? serializeDoc(doc)
      : defaultOvertimeSheet(userId, year, month, {
          employeeName: auth.admin!.displayName || "",
        });
    return NextResponse.json({ success: true, sheet });
  } catch (err: any) {
    console.error("[overtime GET]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to load overtime data" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ success: false, message: "Invalid year or month" }, { status: 400 });
    }

    const userId = String(auth.admin!.id);
    const payload = {
      userId,
      year,
      month,
      employeeName: String(body.employeeName || "").trim(),
      designation: String(body.designation || "SBA-A").trim() || "SBA-A",
      weeklyHoliday: Math.min(6, Math.max(0, Number(body.weeklyHoliday ?? 0))),
      clLeaveDates: parseYmdList(body.clLeaveDates),
      extraDutyEntries: parseExtraEntries(body.extraDutyEntries),
      dutyShift: normalizeDutyShift(body.dutyShift ?? "C"),
      purpose: String(body.purpose || "").trim() || DEFAULT_PURPOSE,
    };

    if (!isDbConnected()) await connectDB();

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
        store.overtimeSheets[idx] = { ...store.overtimeSheets[idx], ...payload, updatedAt: now };
      } else {
        store.overtimeSheets.push({ id: generateId(), ...payload, createdAt: now, updatedAt: now });
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
        sheet: serializeDoc(saved),
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
      sheet: serializeDoc(doc),
    });
  } catch (err: any) {
    console.error("[overtime PUT]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to save overtime data" },
      { status: 500 }
    );
  }
}
