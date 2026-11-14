import { NextRequest, NextResponse } from "next/server";
import { getStore, sanitizeUser } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
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

  const store = getStore();
  const dbUser = store.users.find((u) => u.id === auth.user!.id && u.active);
  if (!dbUser) {
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...sanitizeUser(dbUser),
      shiftLogoutAt: auth.user.shiftLogoutAt,
    },
  });
}
