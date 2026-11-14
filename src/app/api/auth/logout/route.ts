import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({
    success: true,
    message: "Signed out successfully",
  });
  res.cookies.delete("wzpdcl_token");
  res.cookies.delete("token");
  return res;
}
