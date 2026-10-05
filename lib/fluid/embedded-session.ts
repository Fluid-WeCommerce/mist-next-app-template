// This app's short session, not a Fluid JWT. The key is domain separated.
import { createHash, randomUUID } from "node:crypto";
import { hmacSha256, timingSafeEqualBuffers } from "../crypto";
import { sessionTokenConfig, type SessionTokenIdentity } from "./session-token";

export const APP_SESSION_SECONDS = 120;
const key = () => {
  const config = sessionTokenConfig();
  return hmacSha256(config.signingSecret, JSON.stringify([
    "mist embedded application session v1", config.clientId, config.issuer,
  ])).toString("base64url");
};
export function appSessionCookieName(installationId: string): string {
  return `mist_viewer_${createHash("sha256").update(installationId).digest("hex").slice(0, 24)}`;
}
export function createAppSession(
  identity: SessionTokenIdentity,
  installationId: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const body = Buffer.from(JSON.stringify({
    ...identity, installationId, expires: now + APP_SESSION_SECONDS, id: randomUUID(),
  })).toString("base64url");
  return `${body}.${hmacSha256(key(), body).toString("base64url")}`;
}
export function readAppSession(
  value: string | undefined,
  installationId: string,
  servingStore: string,
  now = Math.floor(Date.now() / 1000),
): SessionTokenIdentity | null {
  try {
    if (!value || value.length > 8192) return null;
    const [body, signature, extra] = value.split(".");
    if (extra !== undefined || !body || !signature || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
    if (!timingSafeEqualBuffers(hmacSha256(key(), body), Buffer.from(signature, "base64url"))) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (claims.installationId !== installationId || claims.dest !== servingStore ||
      !Number.isSafeInteger(claims.expires) || claims.expires <= now ||
      claims.expires > now + APP_SESSION_SECONDS ||
      typeof claims.sub !== "string" || !claims.sub.trim()) return null;
    return { sub: claims.sub, dest: claims.dest };
  } catch {
    return null;
  }
}
