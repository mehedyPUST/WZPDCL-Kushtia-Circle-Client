import { NextRequest, NextResponse } from "next/server";
import { getStore, hashPassword, sanitizeUser } from "@/lib/mockStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const email = String(body.email || "").trim();

  if (!username || password.length < 6) {
    return NextResponse.json(
      { success: false, message: "Username and password (min 6 chars) required." },
      { status: 400 }
    );
  }

  const store = getStore();
  if (store.users.some((u) => u.username.toLowerCase() === username)) {
    return NextResponse.json(
      { success: false, message: "Username already exists." },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const user = {
    id: `u-${Date.now()}`,
    username,
    displayName: String(body.displayName || username).trim(),
    email,
    role: "viewer" as const,
    passwordHash: hashPassword(password),
    active: true,
    assignedStations: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.users.push(user);

  return NextResponse.json({
    success: true,
    data: sanitizeUser(user),
  });
}
