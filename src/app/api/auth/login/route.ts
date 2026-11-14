import { NextRequest, NextResponse } from "next/server";
import { getStore, sanitizeUser, verifyPassword } from "@/lib/mockStore";
import { signToken } from "@/lib/serverAuth";
import { computeSessionExpiry } from "@/lib/shiftSession";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUser = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!rawUser || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required." },
        { status: 400 }
      );
    }

    const store = getStore();
    const found = store.users.find(
      (u) =>
        u.active &&
        (u.username.toLowerCase() === rawUser ||
          (u.email && u.email.toLowerCase() === rawUser))
    );

    if (!found || !verifyPassword(password, found.passwordHash)) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password." },
        { status: 401 }
      );
    }

    const token = signToken(found);
    const { shiftLogoutAt, ttlSeconds } = computeSessionExpiry(found.role);
    const userPayload = {
      ...sanitizeUser(found),
      shiftLogoutAt,
    };

    const res = NextResponse.json({
      success: true,
      token,
      data: userPayload,
    });

    res.cookies.set("wzpdcl_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ttlSeconds,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Login failed",
      },
      { status: 500 }
    );
  }
}
