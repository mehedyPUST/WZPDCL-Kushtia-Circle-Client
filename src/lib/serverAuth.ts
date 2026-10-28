import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Verify and sign admin JWTs (compatible with Express JWT_SECRET).
 * Supports Authorization: Bearer <token> and cookie admin_token.
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

export function signToken(payload, expiresInSeconds = 7 * 24 * 60 * 60) {
  const secret = getJwtSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const nowSec = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: nowSec,
      exp: nowSec + expiresInSeconds,
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

export function verifyTokenString(token) {
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
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error("Token expired");
  }
  return payload;
}

/**
 * @returns {{ ok: true, admin: object } | { ok: false, response: NextResponse }}
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
    return {
      ok: true,
      admin: {
        id: payload.id,
        username: payload.username,
        displayName: payload.displayName || "",
        role: payload.role,
        assignedStation: payload.assignedStation || "",
      },
    };
  } catch {
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
