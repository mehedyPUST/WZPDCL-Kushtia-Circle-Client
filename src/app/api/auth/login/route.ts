import { NextResponse } from "next/server";
import { cookieOptionsForRequest, signToken } from "@/lib/serverAuth";
import { computeSessionExpiry } from "@/lib/shiftSession";
import {
  findUserByUsername,
  toPublicUser,
  updateUserAccount,
  verifyUserPassword,
} from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await findUserByUsername(username);

    if (!user || !verifyUserPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (user.isActive === false) {
      return NextResponse.json(
        { success: false, message: "Account is blocked. Contact administrator." },
        { status: 403 }
      );
    }

    const nowIso = new Date().toISOString();
    const updated =
      (await updateUserAccount(
        { id: user.id, username: user.username },
        { lastLogin: nowIso }
      )) || { ...user, lastLogin: nowIso };

    const { shiftLogoutAt, ttlSeconds } = computeSessionExpiry(updated.role);
    const clean = toPublicUser(updated, { shiftLogoutAt });
    const token = signToken(clean, ttlSeconds);

    const res = NextResponse.json({
      success: true,
      message: "Signed in successfully",
      token,
      data: clean,
    });

    res.cookies.set("admin_token", token, cookieOptionsForRequest(request, ttlSeconds));

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Sign in failed" },
      { status: 500 }
    );
  }
}
