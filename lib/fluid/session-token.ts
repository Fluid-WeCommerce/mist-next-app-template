// Server only: identity verification, never Fluid API authorization.
import { hmacSha256, timingSafeEqualBuffers } from "../crypto";

const CLOCK_SKEW_SECONDS = 30;
export type SessionTokenConfig = {
  signingSecret: string;
  clientId: string;
  issuer: string;
};
export type SessionTokenIdentity = { sub: string; dest: string };

export class SessionTokenError extends Error {
  constructor() {
    super("Fluid viewer identity could not be verified");
    this.name = "SessionTokenError";
  }
}

export function sessionTokenConfig(): SessionTokenConfig {
  const signingSecret = process.env.FLUID_SESSION_TOKEN_SIGNING_SECRET;
  const clientId = process.env.FLUID_OAUTH_CLIENT_ID;
  const issuer = process.env.FLUID_SESSION_TOKEN_ISSUER;
  if (!signingSecret?.trim() || !clientId?.trim() || !issuer?.trim()) {
    throw new SessionTokenError();
  }
  return { signingSecret, clientId, issuer };
}

function decodeObject(part: string): Record<string, unknown> {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new SessionTokenError();
  const bytes = Buffer.from(part, "base64url");
  if (bytes.toString("base64url") !== part) throw new SessionTokenError();
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SessionTokenError();
  }
  return value as Record<string, unknown>;
}

export function verifySessionToken(
  token: string,
  servingStore: string,
  config = sessionTokenConfig(),
  now = Math.floor(Date.now() / 1000),
): SessionTokenIdentity {
  try {
    if (!config.signingSecret.trim() || !config.clientId.trim() || !config.issuer.trim()) {
      throw new SessionTokenError();
    }
    if (!/^urn:fluid:store:[^\s]+$/.test(servingStore) || token.length > 16384) {
      throw new SessionTokenError();
    }
    const parts = token.split(".");
    if (parts.length !== 3) throw new SessionTokenError();
    const [header, payload, signature] = parts;
    if (decodeObject(header).alg !== "HS256" || !/^[A-Za-z0-9_-]+$/.test(signature)) {
      throw new SessionTokenError();
    }
    const expected = hmacSha256(config.signingSecret, `${header}.${payload}`);
    const supplied = Buffer.from(signature, "base64url");
    if (!timingSafeEqualBuffers(expected, supplied) || supplied.toString("base64url") !== signature) {
      throw new SessionTokenError();
    }
    const claims = decodeObject(payload);
    if (
      claims.aud !== config.clientId || claims.iss !== config.issuer ||
      !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.nbf) ||
      now >= (claims.exp as number) + CLOCK_SKEW_SECONDS ||
      now + CLOCK_SKEW_SECONDS < (claims.nbf as number) ||
      claims.dest !== servingStore || typeof claims.sub !== "string" || !claims.sub.trim()
    ) throw new SessionTokenError();
    // jti is deliberately not tracked: repeated presentation is legitimate.
    return { sub: claims.sub, dest: servingStore };
  } catch {
    throw new SessionTokenError();
  }
}
