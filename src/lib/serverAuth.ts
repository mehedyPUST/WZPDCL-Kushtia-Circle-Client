import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import {
  computeSessionExpiry,
  isShiftAutoLogoutRole,
  normalizeAuthRole,
  type NormalizedRole,
} from "./shiftSession";

const DEFAULT_SECRET = "wzpdcl-bottail-substation-session-secret";

function getJwtSecret(): string {
  return (process.env.JWT_SECRET || DEFAULT_SECRET).trim() || DEFAULT_SECRET;
}

export class ShiftCutoffError extends Error {
  code = "SHIFT_CUTOFF";
  status = 401;
  cutoffAt: number | null;

  constructor(
    message = "New Shift Started . Please Login with Your Own User ID & Password",
    cutoffAt: number | null = null
  ) {
    super(message);
    this.name = "ShiftCutoffError";
    this.cutoffAt = cutoffAt;
  }
}

export interface TokenUserInput {
  id: string;
  username: string;
  role: string;
  displayName?: string;
  email?: string;
  assignedStations?: string[];
}

export interface VerifiedSessionUser {
  id: string;
  username: string;
  role: NormalizedRole;
  displayName: string;
  email: string;
  assignedStations: string[];
  shiftLogoutAt: number | null;
  iat: number;
  exp: number;
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(str: string): string {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

export function signToken(
  user: TokenUserInput,
  options?: { nowMs?: number; preserveCutoffMs?: number | null }
): string {
  const nowMs = options?.nowMs ?? Date.now();
  const iat = Math.floor(nowMs / 1000);
  const role = normalizeAuthRole(user.role);
  const { shiftLogoutAt, ttlSeconds } = computeSessionExpiry(
    role,
    nowMs,
    options?.preserveCutoffMs ?? null
  );

  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64urlEncode(
    JSON.stringify({
      id: String(user.id),
      username: String(user.username),
      role,
      displayName: user.displayName || user.username,
      email: user.email || "",
      assignedStations: Array.isArray(user.assignedStations)
        ? user.assignedStations
        : [],
      shiftLogoutAt,
      iat,
      exp: iat + ttlSeconds,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signature = b64urlEncode(
    crypto.createHmac("sha256", getJwtSecret()).update(signingInput).digest()
  );

  return `${signingInput}.${signature}`;
}

export function verifyTokenString(
  token: string,
  nowMs: number = Date.now()
): VerifiedSessionUser {
  if (!token || typeof token !== "string") {
    throw new Error("Missing token");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [headerPart, payloadPart, sigPart] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSig = b64urlEncode(
    crypto.createHmac("sha256", getJwtSecret()).update(signingInput).digest()
  );

  const sigBuf = Buffer.from(sigPart);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid token signature");
  }

  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(b64urlDecode(payloadPart));
  } catch {
    throw new Error("Malformed token payload");
  }

  const role = normalizeAuthRole(parsed.role);
  const shiftLogoutAt =
    typeof parsed.shiftLogoutAt === "number" && Number.isFinite(parsed.shiftLogoutAt)
      ? parsed.shiftLogoutAt
      : null;

  if (isShiftAutoLogoutRole(role) && shiftLogoutAt && nowMs >= shiftLogoutAt) {
    throw new ShiftCutoffError(
      "New Shift Started . Please Login with Your Own User ID & Password",
      shiftLogoutAt
    );
  }

  if (typeof parsed.exp === "number" && nowMs >= parsed.exp * 1000) {
    throw new Error("Token expired");
  }

  return {
    id: String(parsed.id || ""),
    username: String(parsed.username || ""),
    role,
    displayName: String(parsed.displayName || parsed.username || ""),
    email: String(parsed.email || ""),
    assignedStations: Array.isArray(parsed.assignedStations)
      ? parsed.assignedStations.map(String)
      : [],
    shiftLogoutAt,
    iat: Number(parsed.iat || 0),
    exp: Number(parsed.exp || 0),
  };
}

export function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }
  const cookieToken =
    req.cookies.get("wzpdcl_token")?.value ||
    req.cookies.get("token")?.value ||
    null;
  return cookieToken || null;
}

export function authenticateRequest(req: NextRequest): {
  user: VerifiedSessionUser | null;
  reason?: string;
  cutoffAt?: number | null;
} {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return { user: null, reason: "no_token" };
  }
  try {
    const user = verifyTokenString(token);
    return { user };
  } catch (err) {
    if (err instanceof ShiftCutoffError) {
      return {
        user: null,
        reason: "shift_cutoff",
        cutoffAt: err.cutoffAt,
      };
    }
    return {
      user: null,
      reason: err instanceof Error ? err.message : "invalid_token",
    };
  }
}
