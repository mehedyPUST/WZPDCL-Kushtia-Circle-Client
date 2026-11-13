import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { findUserByIdOrUsername, toPublicUser } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let current: any = auth.admin;
  try {
    const live = await findUserByIdOrUsername({
      id: auth.admin.id,
      username: auth.admin.username,
    });
    if (live) {
      current = toPublicUser(live, {
        shiftLogoutAt: auth.admin.shiftLogoutAt ?? null,
      });
    }
  } catch {
    // fallback to JWT claims
  }

  return NextResponse.json({
    success: true,
    data: current,
  });
}
