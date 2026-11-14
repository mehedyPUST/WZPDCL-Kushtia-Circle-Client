import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    success: true,
    data: store.settings,
  });
}

export async function PATCH(req: NextRequest) {
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
  const store = getStore();
  store.settings = {
    ...store.settings,
    ...(body && typeof body === "object" ? body : {}),
  };

  return NextResponse.json({
    success: true,
    data: store.settings,
  });
}
