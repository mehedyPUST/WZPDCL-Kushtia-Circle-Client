import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  computeSessionExpiry,
  formatDhakaCutoffHM,
  getNextShiftCutoffMs,
  isShiftAutoLogoutRole,
  normalizeAuthRole,
  STANDARD_SESSION_TTL_SECONDS,
} from "./shiftSession";

/**
 * Verify and sign admin JWTs (compatible with Express JWT_SECRET).
 * Supports Authorization: Bearer <token> and cookie admin_token.
 *
 * Enforces 08:30, 14:30, 20:30 Asia/Dhaka shift cutoff expiry for
 * admin and duty roles. Circle-load-input and viewer roles are exempt.
 */

export function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-only-change-me";
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

function base64UrlDigest(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export class ShiftCutoffError extends Error {
  cutoffAt: number | null;
  constructor(message: string, cutoffAt: number | null = null) {
    super(message);
    this.name = "ShiftCutoffError";
    this.cutoffAt = cutoffAt;
  }
}

export function signToken(
  payload,
  expiresInSeconds = STANDARD_SESSION_TTL_SECONDS
) {
  const secret = getJwtSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  const preserveCutoff =
    typeof payload?.shiftLogoutAt === "number" ? payload.shiftLogoutAt : null;
  const expiry = isShiftAutoLogoutRole(payload?.role)
    ? computeSessionExpiry(payload?.role, nowMs, preserveCutoff)
    : { shiftLogoutAt: null, ttlSeconds: expiresInSeconds };

  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? Math.min(expiresInSeconds, expiry.ttlSeconds)
    : expiry.ttlSeconds;

  const expSec = expiry.shiftLogoutAt
    ? Math.floor(expiry.shiftLogoutAt / 1000)
    : nowSec + ttl;

  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      shiftLogoutAt: expiry.shiftLogoutAt,
      iat: nowSec,
      exp: expSec,
    })
  );
  const data = `${header}.${body}`;
  const sig = base64UrlDigest(createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function getTokenFromRequest(request) {
  const auth =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1].trim());
    } catch {
      return m[1].trim();
    }
  }
  return null;
}

export function verifyTokenString(token, nowMs: number = Date.now()) {
  const secret = getJwtSecret();
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = base64UrlDigest(
    createHmac("sha256", secret).update(data).digest()
  );
  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    const a = Buffer.from(
      sigB64.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );
    const b = createHmac("sha256", secret).update(data).digest();
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid signature");
    }
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64));

  // Enforce 08:30 / 14:30 / 20:30 BST shift cutoff for admin & duty roles
  if (isShiftAutoLogoutRole(payload.role)) {
    const iatMs =
      typeof payload.iat === "number" && payload.iat > 0
        ? payload.iat * 1000
        : nowMs;
    const cutoffMs =
      typeof payload.shiftLogoutAt === "number" && payload.shiftLogoutAt > 0
        ? payload.shiftLogoutAt
        : getNextShiftCutoffMs(iatMs);

    if (nowMs >= cutoffMs) {
      const hm = formatDhakaCutoffHM(cutoffMs);
      throw new ShiftCutoffError(
        `Shift cutoff (${hm} BST) reached. Please sign in again.`,
        cutoffMs
      );
    }
    payload.shiftLogoutAt = cutoffMs;
  } else {
    payload.shiftLogoutAt = null;
  }

  if (payload.exp && nowMs >= payload.exp * 1000) {
    throw new Error("Token expired");
  }
  return payload;
}

export function isHttpsRequest(request): boolean {
  const proto = request?.headers?.get?.("x-forwarded-proto") || "";
  return request?.nextUrl?.protocol === "https:" || proto === "https";
}

export function cookieOptionsForRequest(request, maxAgeSeconds: number) {
  const isSecure = isHttpsRequest(request);
  return {
    httpOnly: true,
    path: "/",
    sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
    secure: isSecure,
    maxAge: maxAgeSeconds,
  };
}

/**
 * @returns {{ ok: true, admin: object } | { ok: false, expiredByShift?: boolean, response: NextResponse }}
 */
export function requireAuth(request) {
  const token = getTokenFromRequest(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please log in.",
        },
        { status: 401 }
      ),
    };
  }

  try {
    const payload = verifyTokenString(token);
    const normRole = normalizeAuthRole(payload.role);
    return {
      ok: true,
      admin: {
        id: payload.id,
        username: payload.username,
        displayName: payload.displayName || "",
        email: payload.email || "",
        role: normRole,
        assignedStation: payload.assignedStation || "",
        lastLogin: payload.lastLogin || null,
        shiftLogoutAt: payload.shiftLogoutAt ?? null,
      },
    };
  } catch (err: any) {
    if (err instanceof ShiftCutoffError || err?.name === "ShiftCutoffError") {
      return {
        ok: false,
        expiredByShift: true,
        cutoffAt: err.cutoffAt ?? null,
        response: NextResponse.json(
          {
            success: false,
            code: "SHIFT_CUTOFF",
            cutoffAt: err.cutoffAt ?? null,
            message:
              err.message ||
              "Shift cutoff reached (08:30 / 14:30 / 20:30 BST). Please log in again.",
          },
          { status: 401 }
        ),
      };
    }

    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Invalid or expired session. Please log in again.",
        },
        { status: 401 }
      ),
    };
  }
}
