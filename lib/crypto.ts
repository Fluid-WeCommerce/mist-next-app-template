// Shared crypto primitives for signature/token verification.
//
// Kept in one place so the HMAC computation and constant-time comparison used
// by webhook signature checks (lib/webhook-verification.ts) and JWT
// verification (lib/jwt.ts) can't drift apart.

import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC-SHA256 of `data` keyed by `secret`, as a raw Buffer.
export function hmacSha256(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

// Constant-time buffer comparison. Returns false on a length mismatch, but
// still performs a comparison so timing doesn't leak the length.
export function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
