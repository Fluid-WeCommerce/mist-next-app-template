import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, tokensMatch, getWebhookHeaders } from "./webhook-verification";

function sign(body: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ name: "order_created" });

  it("accepts a valid, fresh signature", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = sign(body, ts, secret);
    expect(verifyWebhookSignature(body, sig, ts, secret)).toEqual({ valid: true });
  });

  it("rejects a tampered body", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = sign(body, ts, secret);
    const result = verifyWebhookSignature(body + "x", sig, ts, secret);
    expect(result.valid).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = sign(body, ts, secret);
    expect(verifyWebhookSignature(body, sig, ts, "other").valid).toBe(false);
  });

  it("rejects a stale timestamp (replay)", () => {
    const ts = String(Math.floor(Date.now() / 1000) - 10_000);
    const sig = sign(body, ts, secret);
    const result = verifyWebhookSignature(body, sig, ts, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too old/);
  });

  it("rejects missing headers", () => {
    expect(verifyWebhookSignature(body, null, "1", secret).valid).toBe(false);
    expect(verifyWebhookSignature(body, "ab", null, secret).valid).toBe(false);
  });
});

describe("tokensMatch", () => {
  it("matches equal tokens and rejects different ones", () => {
    expect(tokensMatch("abc", "abc")).toBe(true);
    expect(tokensMatch("abc", "abd")).toBe(false);
    expect(tokensMatch("abc", "abcd")).toBe(false);
  });
});

describe("getWebhookHeaders", () => {
  it("extracts fluid headers case-insensitively", () => {
    const h = new Headers({
      "X-Fluid-Signature": "sig",
      "X-Fluid-Timestamp": "123",
      "X-Fluid-Shop": "shop.myfluid.com",
      "AUTH_TOKEN": "tok",
    });
    expect(getWebhookHeaders(h)).toEqual({
      signature: "sig",
      timestamp: "123",
      fluidShop: "shop.myfluid.com",
      authToken: "tok",
    });
  });
});
