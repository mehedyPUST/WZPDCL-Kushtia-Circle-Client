import { NextRequest, NextResponse } from "next/server";
import { getStore, hashPassword, sanitizeUser, verifyPassword } from "@/lib/mockStore";
import { authenticateRequest, signToken } from "@/lib/serverAuth";

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
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!currentPassword || newPassword.length < 6) {
    return NextResponse.json(
      {
        success: false,
        message: "Current password and a new password (min 6 chars) are required.",
      },
      { status: 400 }
    );
  }

  const store = getStore();
  const dbUser = store.users.find((u) => u.id === auth.user!.id && u.active);
  if (!dbUser || !verifyPassword(currentPassword, dbUser.passwordHash)) {
    return NextResponse.json(
      { success: false, message: "Current password is incorrect." },
      { status: 400 }
    );
  }

  dbUser.passwordHash = hashPassword(newPassword);
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
