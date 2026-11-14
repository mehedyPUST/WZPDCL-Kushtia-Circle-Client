import { NextRequest, NextResponse } from "next/server";
import { getStore, hashPassword, sanitizeUser } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";
import { normalizeAuthRole } from "@/lib/shiftSession";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.user || auth.user.role !== "admin") {
    return NextResponse.json(
      {
        success: false,
        message: "Admin access required",
        code: auth.reason === "shift_cutoff" ? "SHIFT_CUTOFF" : "UNAUTHORIZED",
        cutoffAt: auth.cutoffAt ?? null,
      },
      { status: auth.user ? 403 : 401 }
    );
  }

  const store = getStore();
  return NextResponse.json({
    success: true,
    data: store.users.map(sanitizeUser),
  });
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.user || auth.user.role !== "admin") {
    return NextResponse.json(
      {
        success: false,
        message: "Admin access required",
        code: auth.reason === "shift_cutoff" ? "SHIFT_CUTOFF" : "UNAUTHORIZED",
        cutoffAt: auth.cutoffAt ?? null,
      },
      { status: auth.user ? 403 : 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || password.length < 4) {
    return NextResponse.json(
      { success: false, message: "Username and password required." },
      { status: 400 }
    );
  }

  const store = getStore();
  if (store.users.some((u) => u.username.toLowerCase() === username)) {
    return NextResponse.json(
      { success: false, message: "Username already exists." },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const user = {
    id: `u-${Date.now()}`,
    username,
    displayName: String(body.displayName || username).trim(),
    email: String(body.email || "").trim(),
    role: normalizeAuthRole(body.role || "duty"),
    passwordHash: hashPassword(password),
    active: body.active !== false,
    assignedStations: Array.isArray(body.assignedStations)
      ? body.assignedStations.map(String)
      : [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.users.push(user);

  return NextResponse.json({ success: true, data: sanitizeUser(user) });
}
