import { NextResponse } from "next/server";
import { requireAuth, signToken } from "@/lib/serverAuth";
import { getMockStore, hashPassword, verifyPassword } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || "",
    email: user.email || "",
    role: user.role || "viewer",
    assignedStation: user.assignedStation || "",
    isActive: user.isActive !== false,
    lastLogin: user.lastLogin || null,
  };
}

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
export async function POST(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Current password and new password are required",
        },
        { status: 400 }
      );
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "New password must be different from current password",
        },
        { status: 400 }
      );
    }

    const store = getMockStore();
    const user = store.users.find(
      (u) =>
        String(u.id) === String(auth.admin.id) ||
        String(u.username).toLowerCase() ===
          String(auth.admin.username || "").toLowerCase()
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect" },
        { status: 401 }
      );
    }

    user.passwordHash = hashPassword(newPassword);

    const clean = publicUser(user);
    const token = signToken(clean);

    const res = NextResponse.json({
      success: true,
      message: "Password changed successfully",
      token,
      data: clean,
    });

    res.cookies.set("admin_token", token, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Failed to change password",
      },
      { status: 500 }
    );
  }
}
