// Minimal HS256 JWT verification for the Fluid auth handshake.
//
// The /droplet/connect handshake sends the visitor to Fluid, which signs a JWT
// with the droplet's shared secret (FLUID_DROPLET_SECRET) and redirects back to
// /api/auth/callback?token=<jwt>. This verifies that signature — replacing the
// earlier decode-without-verify stub — so a forged token can't mint a session.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface JwtVerifyResult<T> {
  valid: boolean;
  payload?: T;
  error?: string;
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

// Verifies an HS256-signed JWT and returns its decoded payload.
//
// Checks: three-part shape, alg === HS256, HMAC signature over
// "{header}.{payload}", and `exp`/`nbf` claims when present.
export function verifyFluidJwt<T = Record<string, unknown>>(
  token: string,
  secret: string,
): JwtVerifyResult<T> {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, error: "Malformed JWT" };

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(base64urlDecode(headerB64).toString("utf-8"));
  } catch {
    return { valid: false, error: "Invalid JWT header" };
  }

  if (header.alg !== "HS256") {
    return { valid: false, error: `Unsupported JWT alg: ${header.alg}` };
  }

  const expected = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  let provided: Buffer;
  try {
    provided = base64urlDecode(signatureB64);
  } catch {
    return { valid: false, error: "Invalid JWT signature encoding" };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { valid: false, error: "Invalid JWT signature" };
  }

  let payload: T & { exp?: number; nbf?: number };
  try {
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf-8"));
  } catch {
    return { valid: false, error: "Invalid JWT payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) {
    return { valid: false, error: "JWT expired" };
  }
  if (typeof payload.nbf === "number" && now < payload.nbf) {
    return { valid: false, error: "JWT not yet valid" };
  }

  return { valid: true, payload };
}
