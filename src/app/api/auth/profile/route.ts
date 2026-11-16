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
  isEmailTakenByOther,
  toPublicUser,
  updateUserAccount,
} from "@/lib/userStore";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/auth/profile
 * Self-service update: displayName, email (not username/role).
 */
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));

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

    if (user.isActive === false) {
      return NextResponse.json(
        { success: false, message: "Account is blocked" },
        { status: 403 }
      );
    }

    const patch: { displayName?: string; email?: string } = {};

    if (body.displayName !== undefined) {
      patch.displayName = String(body.displayName).trim().slice(0, 80);
    }

    if (body.email !== undefined) {
      const email = String(body.email || "").trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, message: "Invalid email address" },
          { status: 400 }
        );
      }
      if (email && (await isEmailTakenByOther(email, user.id))) {
        return NextResponse.json(
          { success: false, message: "Email already in use" },
          { status: 409 }
        );
      }
      patch.email = email;
    }

    const updated =
      (await updateUserAccount(
        { id: user.id, username: user.username },
        patch
      )) || { ...user, ...patch };

    // Preserve active shift cutoff so profile edits never extend past 08:30/14:30/20:30
    const { shiftLogoutAt, ttlSeconds } = computeSessionExpiry(
      updated.role,
      Date.now(),
      auth.admin.shiftLogoutAt ?? null
    );
    const clean = toPublicUser(updated, { shiftLogoutAt });
    const token = signToken(clean, ttlSeconds);

    const res = NextResponse.json({
      success: true,
      message: "Profile updated",
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
      { success: false, message: err.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
