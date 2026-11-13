import { NextResponse } from "next/server";
import { getMockStore, verifyPassword } from "@/lib/mockStore";
import { signToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

function sanitizeUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName || "",
    email: u.email || "",
    role: u.role || "viewer",
    assignedStation: u.assignedStation || "",
    isActive: u.isActive !== false,
    lastLogin: u.lastLogin || null,
  };
}

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

    const store = getMockStore();
    const user = store.users.find(
      (u) => String(u.username || "").toLowerCase() === username
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
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

    user.lastLogin = new Date().toISOString();
    const clean = sanitizeUser(user);
    const token = signToken(clean);

    const res = NextResponse.json({
      success: true,
      message: "Signed in successfully",
      token,
      data: clean,
    });

    const proto = request.headers.get("x-forwarded-proto") || "";
    const isSecure = request.nextUrl?.protocol === "https:" || proto === "https";

    res.cookies.set("admin_token", token, {
      httpOnly: true,
      path: "/",
      sameSite: isSecure ? "none" : "lax",
      secure: isSecure,
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || "Sign in failed" },
      { status: 500 }
    );
  }
}
