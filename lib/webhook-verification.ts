// Webhook signature verification.
//
// Verifies HMAC-SHA256 signatures on incoming webhooks from Fluid. Fluid sends:
//   X-Fluid-Timestamp: unix timestamp when the webhook was sent
//   X-Fluid-Signature: HMAC-SHA256 hex digest of "{timestamp}.{rawBody}"
//   X-Fluid-Shop:      the fluid_shop identifier of the sending company
//   AUTH_TOKEN:        legacy shared-secret header (fallback)

import { createHmac, timingSafeEqual } from "node:crypto";

// Reject signatures older than this to blunt replay attacks.
const MAX_SIGNATURE_AGE_SECONDS = 300;

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

// Verifies the HMAC signature of a webhook request.
//
// body      - Raw request body as a string (verify the bytes Fluid signed).
// signature - X-Fluid-Signature header value.
// timestamp - X-Fluid-Timestamp header value.
// secret    - Webhook verification token (per-company, or the global secret
//             for lifecycle events).
export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
): WebhookVerificationResult {
  if (!signature) return { valid: false, error: "Missing X-Fluid-Signature header" };
  if (!timestamp) return { valid: false, error: "Missing X-Fluid-Timestamp header" };

  const timestampNum = parseInt(timestamp, 10);
  if (Number.isNaN(timestampNum)) {
    return { valid: false, error: "Invalid X-Fluid-Timestamp format" };
  }

  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestampNum);
  if (age > MAX_SIGNATURE_AGE_SECONDS) {
    return {
      valid: false,
      error: `Webhook timestamp too old (${age}s). Max allowed: ${MAX_SIGNATURE_AGE_SECONDS}s`,
    };
  }

  // Fluid signs "{timestamp}.{body}".
  const signedPayload = `${timestamp}.${body}`;
  const expectedSignature = createHmac("sha256", secret).update(signedPayload).digest("hex");

  try {
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: "Invalid signature" };
    }
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, error: "Invalid signature" };
    }
  } catch {
    return { valid: false, error: "Invalid signature format" };
  }

  return { valid: true };
}

// Constant-time comparison for shared-secret token checks.
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison to keep timing roughly constant.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Extracts the webhook verification headers from a request.
export function getWebhookHeaders(headers: Headers): {
  signature: string | null;
  timestamp: string | null;
  authToken: string | null;
  fluidShop: string | null;
} {
  return {
    signature: headers.get("x-fluid-signature"),
    timestamp: headers.get("x-fluid-timestamp"),
    authToken:
      headers.get("auth-token") ||
      headers.get("auth_token") ||
      headers.get("x-auth-token") ||
      headers.get("authorization")?.replace("Bearer ", "") ||
      null,
    fluidShop: headers.get("x-fluid-shop"),
  };
}
