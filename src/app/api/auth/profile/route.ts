import { NextResponse } from "next/server";
import { requireAuth, signToken } from "@/lib/serverAuth";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

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
 * PATCH /api/auth/profile
 * Self-service update: displayName, email (not username/role).
 */
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
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

    if (user.isActive === false) {
      return NextResponse.json(
        { success: false, message: "Account is blocked" },
        { status: 403 }
      );
    }

    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim().slice(0, 80);
      user.displayName = name;
    }

    if (body.email !== undefined) {
      const email = String(body.email || "").trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, message: "Invalid email address" },
          { status: 400 }
        );
      }
      // uniqueness among other users
      if (email) {
        const clash = store.users.find(
          (u) =>
            u.id !== user.id &&
            String(u.email || "").toLowerCase() === email
        );
        if (clash) {
          return NextResponse.json(
            { success: false, message: "Email already in use" },
            { status: 409 }
          );
        }
      }
      user.email = email || "";
    }

    const clean = publicUser(user);
    const token = signToken(clean);

    const res = NextResponse.json({
      success: true,
      message: "Profile updated",
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
      { success: false, message: err.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
