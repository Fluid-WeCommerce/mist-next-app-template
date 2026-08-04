import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as runAuthCallback } from "../app/api/auth/[...fluid]/route";
import { GET as startHandshake } from "../app/droplet/connect/route";
import { hmacSha256 } from "./crypto";

const secret = "local-test-secret";

function signedFluidToken(): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      user_id: 42,
      user_name: "Test User",
      company_id: 7,
      company_name: "Test Company",
    }),
  ).toString("base64url");
  const signature = hmacSha256(secret, `${header}.${payload}`).toString(
    "base64url",
  );
  return `${header}.${payload}.${signature}`;
}

async function runCallback(returnTo: string) {
  const url = new URL("https://mist.example/api/auth/callback");
  url.searchParams.set("token", signedFluidToken());
  url.searchParams.set("return_to", returnTo);

  return runAuthCallback(new NextRequest(url), {
    params: Promise.resolve({ fluid: ["callback"] }),
  });
}

async function runConnect(returnTo: string) {
  const url = new URL("https://mist.example/droplet/connect");
  url.searchParams.set("return_to", returnTo);
  return startHandshake(new NextRequest(url));
}

describe("Fluid auth callback return target", () => {
  afterEach(() => {
    delete process.env.FLUID_DROPLET_SECRET;
    delete process.env.FLUID_DROPLET_UUID;
    delete process.env.FLUID_BASE_URL;
  });

  it("falls back to the app root for an absolute external target", async () => {
    process.env.FLUID_DROPLET_SECRET = secret;

    const response = await runCallback("https://attacker.example/phish");

    expect(response.headers.get("location")).toBe("https://mist.example/");
  });

  it.each([
    "//attacker.example/phish",
    "javascript:alert(1)",
    "https://[invalid",
  ])("falls back to the app root for unsafe target %s", async (returnTo) => {
    process.env.FLUID_DROPLET_SECRET = secret;

    const response = await runCallback(returnTo);

    expect(response.headers.get("location")).toBe("https://mist.example/");
  });

  it("preserves a local path, query, and fragment", async () => {
    process.env.FLUID_DROPLET_SECRET = secret;

    const response = await runCallback("/coach?week=1#today");

    expect(response.headers.get("location")).toBe(
      "https://mist.example/coach?week=1#today",
    );
  });

  it("normalizes a same-origin absolute URL to a local destination", async () => {
    process.env.FLUID_DROPLET_SECRET = secret;

    const response = await runCallback(
      "https://mist.example/coach?week=1#today",
    );

    expect(response.headers.get("location")).toBe(
      "https://mist.example/coach?week=1#today",
    );
  });

  it("does not forward an external target into the Fluid handshake", async () => {
    process.env.FLUID_DROPLET_UUID = "drp_local_test";
    process.env.FLUID_BASE_URL = "https://fluid.example";

    const response = await runConnect("https://attacker.example/phish");
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.origin).toBe("https://fluid.example");
    expect(location.searchParams.get("return_to")).toBe("/");
  });
});
