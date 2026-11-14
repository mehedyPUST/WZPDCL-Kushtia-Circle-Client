import { NextRequest, NextResponse } from "next/server";
import { dhakaNowParts } from "@/lib/dutyShifts";
import { getDefaultFeederRegistry, getStore } from "@/lib/mockStore";
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
  const key = `${year}-${String(month).padStart(2, "0")}`;

  const store = getStore();
  const sheet = store.monthlyEnergySheets[key] || {
    year,
    month,
    rows: [],
    notes: "",
    updatedByUsername: "",
    updatedByDisplayName: "",
    updatedAt: null,
  };

  return NextResponse.json({
    success: true,
    sheet,
    feeders: getDefaultFeederRegistry(),
  });
}

export async function PUT(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}));
  const nowParts = dhakaNowParts();
  const [curYear, curMonth] = nowParts.ymd.split("-").map(Number);
  const year = Number(body.year) || curYear;
  const month = Number(body.month) || curMonth;
  const key = `${year}-${String(month).padStart(2, "0")}`;

  const store = getStore();
  const nowIso = new Date().toISOString();
  const sheet = {
    year,
    month,
    rows: Array.isArray(body.rows) ? body.rows : [],
    notes: String(body.notes || ""),
    updatedByUsername: auth.user.username,
    updatedByDisplayName: auth.user.displayName || auth.user.username,
    updatedAt: nowIso,
  };
  store.monthlyEnergySheets[key] = sheet;

  return NextResponse.json({
    success: true,
    sheet,
    feeders: getDefaultFeederRegistry(),
  });
}
