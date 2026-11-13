import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import Calculation from "@/lib/models/Calculation";
import { getMockStore } from "@/lib/mockStore";
import {
  buildMonthlyDutyRoster,
  dhakaNowParts,
  monthQueryBounds,
} from "@/lib/dutyShifts";

export const dynamic = "force-dynamic";

function isAdminUser(admin) {
  const r = String(admin?.role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

function dayBoundsFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - OFFSET_MS);
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - OFFSET_MS);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end };
}

export async function GET(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!isAdminUser(auth.admin)) {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const { ymd: todayYmd, hour: todayHour } = dhakaNowParts(now);
    let year = parseInt(searchParams.get("year") || "", 10);
    let month = parseInt(searchParams.get("month") || "", 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      year = Number(todayYmd.slice(0, 4));
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      month = Number(todayYmd.slice(5, 7));
    }

    const { from, to } = monthQueryBounds(year, month);
    const fromB = dayBoundsFromYmd(from);
    const toB = dayBoundsFromYmd(to);

    await connectDB();

    let records = [];

    if (!isDbConnected()) {
      const store = getMockStore();
      records = (store.calculations || []).filter((d) => {
        if (d.deletedAt) return false;
        const ev = new Date(d.calculatedAt || d.createdAt).getTime();
        if (Number.isNaN(ev)) return false;
        if (fromB && ev < fromB.start.getTime()) return false;
        if (toB && ev >= toB.end.getTime()) return false;
        return true;
      });
    } else {
      const eventAt = { $ifNull: ["$calculatedAt", "$createdAt"] };
      const filter = {
        $and: [
          { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
          {
            $expr: {
              $and: [
                { $gte: [eventAt, fromB.start] },
                { $lt: [eventAt, toB.end] },
              ],
            },
          },
        ],
      };
      records = await Calculation.find(filter)
        .select(
          "hourSlot calculatedAt createdAt createdBy createdByUsername totalMW isHourly"
        )
        .lean()
        .limit(20000);
    }

    const roster = buildMonthlyDutyRoster(records, year, month, {
      todayYmd,
      todayHour,
    });

    return NextResponse.json({
      success: true,
      data: roster,
      meta: {
        from,
        to,
        todayYmd,
        recordCount: records.length,
        unattributed: roster.unattributed,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/duty-roster:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to build duty roster" },
      { status: 500 }
    );
  }
}
