import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return NextResponse.json({
      success: true,
      authenticated: false,
    });
  }
  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: auth.admin,
    data: auth.admin,
  });
}
