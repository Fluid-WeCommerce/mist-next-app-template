import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hmacSha256 } from "../crypto";
import { SessionTokenError, verifySessionToken } from "./session-token";
import { createAppSession, readAppSession } from "./embedded-session";

const secret = "test-only-session-signing-key";
const store = "urn:fluid:store:019a0000-0000-7000-8000-000000000001";
const now = 1800000000;
const claims = { iss: "https://fluid.test", aud: "client-test", dest: store, sub: "urn:fluid:store_admin:opaque-id", nbf: now, exp: now + 60, jti: "reusable" };
function sign(overrides: Record<string, unknown> = {}, alg = "HS256", signingSecret = secret) {
  const header = Buffer.from(JSON.stringify({ alg })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString("base64url");
  return `${header}.${body}.${hmacSha256(signingSecret, `${header}.${body}`).toString("base64url")}`;
}
const verify = (token: string, time = now) => verifySessionToken(token, store, undefined, time);
beforeEach(() => {
  vi.stubEnv("FLUID_SESSION_TOKEN_SIGNING_SECRET", secret);
  vi.stubEnv("FLUID_OAUTH_CLIENT_ID", "client-test");
  vi.stubEnv("FLUID_SESSION_TOKEN_ISSUER", "https://fluid.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("Fluid session-token contract", () => {
  it("accepts valid identity and repeated jti", () => {
    const token = sign();
    for (let i = 0; i < 2; i++) expect(verify(token)).toEqual({ sub: claims.sub, dest: store });
  });
  it.each([
    { aud: "other" }, { aud: ["client-test"] }, { iss: "other" }, { dest: "urn:fluid:store:other" },
    { exp: undefined }, { nbf: undefined }, { exp: now + 1.5 }, { nbf: now - 0.5 },
    { exp: "1800000060" }, { nbf: null }, { sub: undefined }, { sub: "  " },
    { exp: now - 30 }, { nbf: now + 31 },
  ])("rejects malformed/mismatched claims: %j", (overrides) => {
    expect(() => verify(sign(overrides))).toThrow(SessionTokenError);
  });
  it.each(["none", "HS512", "RS256"])("rejects algorithm %s even with valid HMAC", (alg) => {
    expect(() => verify(sign({}, alg))).toThrow(SessionTokenError);
  });
  it("rejects a different signing secret and tampering without leaking token material", () => {
    const token = sign({}, "HS256", "another-test-secret");
    expect(() => verify(token)).toThrow("Fluid viewer identity could not be verified");
    expect(() => verify(sign().replace(".", ".changed"))).toThrow(SessionTokenError);
  });
  it("uses fixed 30-second skew with an exclusive expiry boundary", () => {
    expect(verify(sign({ exp: now - 29 }))).toEqual({ sub: claims.sub, dest: store });
    expect(verify(sign({ nbf: now + 30 }))).toEqual({ sub: claims.sub, dest: store });
    expect(() => verify(sign({ exp: now - 30 }))).toThrow(SessionTokenError);
  });
  it.each(["FLUID_SESSION_TOKEN_SIGNING_SECRET", "FLUID_OAUTH_CLIENT_ID", "FLUID_SESSION_TOKEN_ISSUER"])("fails closed without %s", (name) => {
    vi.stubEnv(name, "");
    expect(() => verify(sign())).toThrow(SessionTokenError);
  });
  it.each(["", "a.b", "a.b.c.d", "e30.e30."])("rejects malformed compact input %s", (token) => {
    expect(() => verify(token)).toThrow(SessionTokenError);
  });
});

describe("short application session", () => {
  it("binds identity to installation/store, expires after 120 seconds, and contains no Fluid JWT", () => {
    const identity = verify(sign());
    const cookie = createAppSession(identity, "dri_test", now);
    expect(cookie.split(".")).toHaveLength(2);
    expect(cookie).not.toContain(sign());
    expect(readAppSession(cookie, "dri_test", store, now + 119)).toEqual(identity);
    expect(readAppSession(cookie, "dri_test", store, now + 120)).toBeNull();
    expect(readAppSession(cookie, "dri_other", store, now)).toBeNull();
    expect(readAppSession(cookie, "dri_test", "urn:fluid:store:other", now)).toBeNull();
    expect(readAppSession(`${cookie}x`, "dri_test", store, now)).toBeNull();
  });
  it("invalidates app sessions on signing-key rotation and rejects Fluid tokens as cookies", () => {
    const cookie = createAppSession(verify(sign()), "dri_test", now);
    vi.stubEnv("FLUID_SESSION_TOKEN_SIGNING_SECRET", "rotated-test-key");
    expect(readAppSession(cookie, "dri_test", store, now)).toBeNull();
    expect(readAppSession(sign(), "dri_test", store, now)).toBeNull();
  });
});
