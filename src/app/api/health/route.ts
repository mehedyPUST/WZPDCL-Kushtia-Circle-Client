import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = "mock";
  try {
    await connectDB();
    db = isDbConnected() ? "connected" : "mock";
  } catch {
    db = "mock";
  }

  return NextResponse.json(
    {
      success: true,
      message: "Load Calculator API is running",
      db,
      buildId: process.env.NEXT_PUBLIC_APP_BUILD_ID || "dev",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
