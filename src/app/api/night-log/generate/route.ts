import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.user) {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication required",
        code: auth.reason === "shift_cutoff" ? "SHIFT_CUTOFF" : "UNAUTHORIZED",
        cutoffAt: auth.cutoffAt ?? null,
      },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const dayKey = String(body.dayKey || "");
  const startSlot = String(body.startSlot || "00:00");
  const endSlot = String(body.endSlot || "08:00");
  const slots = body.slots && typeof body.slots === "object" ? body.slots : {};

  return NextResponse.json({
    success: true,
    data: {
      dayKey,
      startSlot,
      endSlot,
      slots,
      generatedAt: new Date().toISOString(),
      mode: "deterministic",
    },
  });
}
