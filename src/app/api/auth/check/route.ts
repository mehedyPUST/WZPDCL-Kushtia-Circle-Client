import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { findUserByIdOrUsername, toPublicUser } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return NextResponse.json({
      success: true,
      authenticated: false,
      ...(auth.expiredByShift
        ? { reason: "shift_cutoff", cutoffAt: auth.cutoffAt ?? null }
        : {}),
    });
  }

  let current: any = auth.admin;
  try {
    const live = await findUserByIdOrUsername({
      id: auth.admin.id,
      username: auth.admin.username,
    });
    if (live) {
      if (live.isActive === false) {
        return NextResponse.json({
          success: true,
          authenticated: false,
          reason: "blocked",
        });
      }
      current = toPublicUser(live, {
        shiftLogoutAt: auth.admin.shiftLogoutAt ?? null,
      });
    }
  } catch {
    // Fallback to verified JWT claims if store lookup fails
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: current,
    data: current,
  });
}
