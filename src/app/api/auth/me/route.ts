import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    success: true,
    data: auth.admin,
  });
}
