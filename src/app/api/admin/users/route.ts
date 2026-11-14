import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import {
  createUserAccount,
  listAllUsers,
  toPublicUser,
} from "@/lib/userStore";

export const dynamic = "force-dynamic";

function isAdminUser(admin) {
  const r = String(admin?.role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

export async function GET(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!isAdminUser(auth.admin)) {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 }
    );
  }

  const users = await listAllUsers();
  return NextResponse.json({
    success: true,
    data: users.map((u) => toPublicUser(u)),
  });
}

export async function POST(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!isAdminUser(auth.admin)) {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 }
    );
  }

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

    const email = String(body.email || "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email address" },
        { status: 400 }
      );
    }

    const { user, conflict } = await createUserAccount({
      username,
      password,
      displayName: String(body.displayName || ""),
      email,
      role: body.role || "viewer",
      assignedStation: String(body.assignedStation || ""),
    });

    if (conflict || !user) {
      return NextResponse.json(
        { success: false, message: conflict || "Failed to create user" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "User created",
        data: toPublicUser(user),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
