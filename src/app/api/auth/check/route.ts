import { NextRequest, NextResponse } from "next/server";
import { getStore, sanitizeUser } from "@/lib/mockStore";
import { authenticateRequest } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.user) {
    return NextResponse.json({
      success: true,
      authenticated: false,
      reason: auth.reason || "unauthenticated",
      cutoffAt: auth.cutoffAt ?? null,
    });
  }

  const store = getStore();
  const dbUser = store.users.find((u) => u.id === auth.user!.id && u.active);
  if (!dbUser) {
    return NextResponse.json({
      success: true,
      authenticated: false,
      reason: "user_not_found",
    });
  }

  const data = {
    ...sanitizeUser(dbUser),
    shiftLogoutAt: auth.user.shiftLogoutAt,
  };

  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: data,
    data,
  });
}
