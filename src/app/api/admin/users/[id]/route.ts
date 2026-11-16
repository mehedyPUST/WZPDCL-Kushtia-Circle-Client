import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import {
  deleteUserAccount,
  findUserByIdOrUsername,
  isEmailTakenByOther,
  toPublicUser,
  updateUserAccount,
} from "@/lib/userStore";

export const dynamic = "force-dynamic";

function isAdminUser(admin) {
  const r = String(admin?.role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!isAdminUser(auth.admin)) {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const existing = await findUserByIdOrUsername({ id });
  if (!existing) {
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );
  }

  const patch: Record<string, any> = {};
  if (body.displayName !== undefined) {
    patch.displayName = String(body.displayName).trim().slice(0, 80);
  }
  if (body.email !== undefined) {
    const email = String(body.email || "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email address" },
        { status: 400 }
      );
    }
    if (email && (await isEmailTakenByOther(email, existing.id))) {
      return NextResponse.json(
        { success: false, message: "Email already in use" },
        { status: 409 }
      );
    }
    patch.email = email;
  }
  if (body.role !== undefined) patch.role = body.role;
  if (body.assignedStation !== undefined) {
    patch.assignedStation = String(body.assignedStation);
  }
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  if (body.password) patch.password = String(body.password);

  const updated = await updateUserAccount(
    { id: existing.id, username: existing.username },
    patch
  );

  return NextResponse.json({
    success: true,
    message: "User updated",
    data: toPublicUser(updated || existing),
  });
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!isAdminUser(auth.admin)) {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const deleted = await deleteUserAccount(id);
  if (!deleted) {
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "User deleted",
  });
}
