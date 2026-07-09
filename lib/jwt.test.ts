import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyFluidJwt } from "./jwt";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function makeJwt(payload: Record<string, unknown>, secret: string, alg = "HS256"): string {
  const header = b64url(JSON.stringify({ alg, typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig =
    alg === "HS256"
      ? b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest())
      : b64url("bad");
  return `${header}.${body}.${sig}`;
}

describe("verifyFluidJwt", () => {
  const secret = "droplet-secret";
  const session = { user_id: 1, user_name: "Ada", company_id: 9, company_name: "Acme" };

  it("verifies a valid token and returns the payload", () => {
    const token = makeJwt(session, secret);
    const result = verifyFluidJwt<typeof session>(token, secret);
    expect(result.valid).toBe(true);
    expect(result.payload).toMatchObject(session);
  });

  it("rejects a wrong secret", () => {
    const token = makeJwt(session, secret);
    expect(verifyFluidJwt(token, "nope").valid).toBe(false);
  });

  it("rejects a non-HS256 alg (alg confusion)", () => {
    const token = makeJwt(session, secret, "none");
    expect(verifyFluidJwt(token, secret).valid).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = makeJwt({ ...session, exp: Math.floor(Date.now() / 1000) - 60 }, secret);
    const result = verifyFluidJwt(token, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/);
  });

  it("rejects a malformed token", () => {
    expect(verifyFluidJwt("not.a.jwt.extra", secret).valid).toBe(false);
    expect(verifyFluidJwt("only-one-part", secret).valid).toBe(false);
  });
});
