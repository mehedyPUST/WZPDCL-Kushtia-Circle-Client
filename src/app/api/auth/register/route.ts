import { NextResponse } from "next/server";
import { cookieOptionsForRequest, signToken } from "@/lib/serverAuth";
import { computeSessionExpiry } from "@/lib/shiftSession";
import { createUserAccount, toPublicUser } from "@/lib/userStore";

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

    const { user, conflict } = await createUserAccount({
      username,
      password,
      displayName: String(body.displayName || username),
      email: String(body.email || ""),
      role: "admin",
      assignedStation: "",
      lastLogin: new Date().toISOString(),
    });

    if (conflict || !user) {
      return NextResponse.json(
        { success: false, message: conflict || "Registration failed" },
        { status: 409 }
      );
    }

    const { shiftLogoutAt, ttlSeconds } = computeSessionExpiry(user.role);
    const clean = toPublicUser(user, { shiftLogoutAt });
    const token = signToken(clean, ttlSeconds);

    const res = NextResponse.json(
      {
        success: true,
        message: "Admin registered successfully",
        token,
        data: clean,
      },
      { status: 201 }
    );
    res.cookies.set("admin_token", token, cookieOptionsForRequest(request, ttlSeconds));
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Registration failed" },
      { status: 500 }
    );
  }
}
