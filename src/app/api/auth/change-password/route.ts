import { NextResponse } from "next/server";
import {
  cookieOptionsForRequest,
  requireAuth,
  signToken,
} from "@/lib/serverAuth";
import { computeSessionExpiry } from "@/lib/shiftSession";
import {
  ensureMockUserFromAuth,
  findUserByIdOrUsername,
  toPublicUser,
  updateUserAccount,
  verifyUserPassword,
} from "@/lib/userStore";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

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

    let user = await findUserByIdOrUsername({
      id: auth.admin.id,
      username: auth.admin.username,
    });

    if (!user) {
      user = ensureMockUserFromAuth(auth.admin);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    if (!verifyUserPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const updated =
      (await updateUserAccount(
        { id: user.id, username: user.username },
        { password: newPassword }
      )) || user;

    const { shiftLogoutAt, ttlSeconds } = computeSessionExpiry(
      updated.role,
      Date.now(),
      auth.admin.shiftLogoutAt ?? null
    );
    const clean = toPublicUser(updated, { shiftLogoutAt });
    const token = signToken(clean, ttlSeconds);

    const res = NextResponse.json({
      success: true,
      message: "Password changed successfully",
      token,
      data: clean,
    });

    res.cookies.set(
      "admin_token",
      token,
      cookieOptionsForRequest(request, ttlSeconds)
    );

    return res;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Failed to change password",
      },
      { status: 500 }
    );
  }
}
