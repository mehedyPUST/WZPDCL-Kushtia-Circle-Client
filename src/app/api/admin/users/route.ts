import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { getMockStore, hashPassword, generateId } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

function isAdminUser(admin) {
  const r = String(admin?.role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase().replace(/_/g, "-");
  if (r === "viewer") return "viewer";
  if (r === "circle-load-input" || r === "circleloadinput" || r === "circle-input")
    return "circle-load-input";
  if (r === "duty" || r === "duty-person" || r === "operator") return "duty";
  if (r === "admin" || r === "superadmin") return "admin";
  return "viewer";
}

function sanitizeUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName || "",
    role: normalizeRole(u.role || "viewer"),
    assignedStation: u.assignedStation || "",
    isActive: u.isActive !== false,
    createdAt: u.createdAt || null,
    lastLogin: u.lastLogin || null,
  };
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

  const store = getMockStore();
  return NextResponse.json({
    success: true,
    data: store.users.map(sanitizeUser),
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
      username: username.toLowerCase(),
      displayName: String(body.displayName || ""),
      role: normalizeRole(body.role || "viewer"),
      assignedStation: String(body.assignedStation || ""),
      isActive: true,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };
    store.users.push(user);

    return NextResponse.json(
      {
        success: true,
        message: "User created",
        data: sanitizeUser(user),
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
