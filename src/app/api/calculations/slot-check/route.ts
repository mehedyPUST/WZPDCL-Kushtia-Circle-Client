import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";
import Calculation from "@/lib/models/Calculation";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

const activeFilter = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const hourSlot = String(searchParams.get("hourSlot") || "").trim();
    const dayStart = searchParams.get("dayStart")
      ? new Date(searchParams.get("dayStart"))
      : null;
    const dayEnd = searchParams.get("dayEnd")
      ? new Date(searchParams.get("dayEnd"))
      : null;

    if (
      !hourSlot ||
      !dayStart ||
      !dayEnd ||
      Number.isNaN(dayStart.getTime()) ||
      Number.isNaN(dayEnd.getTime())
    ) {
      return NextResponse.json(
        { success: false, message: "hourSlot, dayStart and dayEnd are required" },
        { status: 400 }
      );
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      const sMs = dayStart.getTime();
      const eMs = dayEnd.getTime();
      const candidates = store.calculations.filter((d) => {
        if (d.deletedAt) return false;
        if (String(d.hourSlot || "").trim() !== hourSlot) return false;
        const ev = new Date(d.calculatedAt || d.createdAt).getTime();
        return !Number.isNaN(ev) && ev >= sMs && ev < eMs;
      });
      candidates.sort(
        (a, b) =>
          new Date(b.calculatedAt || b.createdAt).getTime() -
          new Date(a.calculatedAt || a.createdAt).getTime()
      );
      const existing = candidates[0] || null;
      return NextResponse.json({
        success: true,
        exists: !!existing,
        data: existing
          ? {
              _id: existing._id,
              hourSlot: existing.hourSlot,
              calculatedAt: existing.calculatedAt,
              totalMW: existing.totalMW,
              note: existing.note || "",
            }
          : null,
      });
    }

    const existing = await Calculation.findOne({
      $and: [
        activeFilter,
        { hourSlot },
        {
          $or: [
            { calculatedAt: { $gte: dayStart, $lt: dayEnd } },
            {
              calculatedAt: { $exists: false },
              createdAt: { $gte: dayStart, $lt: dayEnd },
            },
          ],
        },
      ],
    })
      .sort({ calculatedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      exists: !!existing,
      data: existing
        ? {
            _id: existing._id,
            hourSlot: existing.hourSlot,
            calculatedAt: existing.calculatedAt,
            totalMW: existing.totalMW,
            note: existing.note || "",
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/calculations/slot-check:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to check slot" },
      { status: 500 }
    );
  }
}
