import { NextRequest, NextResponse } from "next/server";
import { getStore, sanitizeUser } from "@/lib/mockStore";
import { authenticateRequest, signToken } from "@/lib/serverAuth";

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
  const dbUser = store.users.find((u) => u.id === auth.user!.id && u.active);
  if (!dbUser) {
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );
  }

  if (typeof body.displayName === "string" && body.displayName.trim()) {
    dbUser.displayName = body.displayName.trim();
  }
  if (typeof body.email === "string") {
    dbUser.email = body.email.trim();
  }
  dbUser.updatedAt = new Date().toISOString();

  const token = signToken(dbUser, {
    preserveCutoffMs: auth.user.shiftLogoutAt,
  });

  return NextResponse.json({
    success: true,
    token,
    data: {
      ...sanitizeUser(dbUser),
      shiftLogoutAt: auth.user.shiftLogoutAt,
    },
  });
}
