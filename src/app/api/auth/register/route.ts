import { NextResponse } from "next/server";
import { getMockStore, hashPassword, generateId } from "@/lib/mockStore";
import { signToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      );
    }

    const store = getMockStore();
    if (
      store.users.some(
        (u) => String(u.username || "").toLowerCase() === username.toLowerCase()
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Username already exists" },
        { status: 409 }
      );
    }

    const user = {
      id: generateId(),
      username,
      displayName: String(body.displayName || username),
      role: "admin",
      assignedStation: "",
      isActive: true,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    store.users.push(user);

    const clean = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      assignedStation: user.assignedStation,
      isActive: true,
    };
    const token = signToken(clean);

    return NextResponse.json(
      {
        success: true,
        message: "Admin registered successfully",
        token,
        data: clean,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || "Registration failed" },
      { status: 500 }
    );
  }
}
