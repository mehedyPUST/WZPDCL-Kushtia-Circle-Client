import { NextRequest, NextResponse } from "next/server";
import { getStore, hashPassword, sanitizeUser } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";
import { normalizeAuthRole } from "@/lib/shiftSession";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const store = getStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) {
    return NextResponse.json(
      { success: false, message: "User not found." },
      { status: 404 }
    );
  }

  if (typeof body.displayName === "string") user.displayName = body.displayName.trim();
  if (typeof body.email === "string") user.email = body.email.trim();
  if (typeof body.role === "string") user.role = normalizeAuthRole(body.role);
  if (typeof body.active === "boolean") user.active = body.active;
  if (Array.isArray(body.assignedStations)) {
    user.assignedStations = body.assignedStations.map(String);
  }
  if (typeof body.password === "string" && body.password.length >= 4) {
    user.passwordHash = hashPassword(body.password);
  }
  user.updatedAt = new Date().toISOString();

  return NextResponse.json({ success: true, data: sanitizeUser(user) });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params;
  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === id);
  if (idx === -1) {
    return NextResponse.json(
      { success: false, message: "User not found." },
      { status: 404 }
    );
  }
  if (store.users[idx].id === auth.user.id) {
    return NextResponse.json(
      { success: false, message: "Cannot delete your own active account." },
      { status: 400 }
    );
  }
  store.users.splice(idx, 1);

  return NextResponse.json({ success: true });
}
