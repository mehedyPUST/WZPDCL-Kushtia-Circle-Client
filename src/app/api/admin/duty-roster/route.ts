import { NextRequest, NextResponse } from "next/server";
import { buildMonthlyDutyRoster, dhakaNowParts } from "@/lib/dutyShifts";
import { getStore } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.user || auth.user.role !== "admin") {
    return NextResponse.json(
      {
        success: false,
        message: "Admin access required",
        code: auth.reason === "shift_cutoff" ? "SHIFT_CUTOFF" : "UNAUTHORIZED",
        cutoffAt: auth.cutoffAt ?? null,
      },
      { status: auth.user ? 403 : 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const nowParts = dhakaNowParts();
  const [curYear, curMonth] = nowParts.ymd.split("-").map(Number);
  const year = Number(searchParams.get("year")) || curYear;
  const month = Number(searchParams.get("month")) || curMonth;

  const store = getStore();
  const roster = buildMonthlyDutyRoster(
    store.calculations.filter((c) => !c.deleted),
    year,
    month
  );

  return NextResponse.json({
    success: true,
    data: roster,
    meta: { year, month },
  });
}
