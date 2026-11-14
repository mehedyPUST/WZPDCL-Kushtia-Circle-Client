import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const proto = request.headers.get("x-forwarded-proto") || "";
  const isSecure = request.nextUrl?.protocol === "https:" || proto === "https";
  const res = NextResponse.json({
    success: true,
    message: "Signed out successfully",
  });
  res.cookies.set("admin_token", "", {
    httpOnly: true,
    path: "/",
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    maxAge: 0,
  });
  return res;
}
