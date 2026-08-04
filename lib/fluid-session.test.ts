import { afterEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "mist_session" && cookieValue.current
        ? { value: cookieValue.current }
        : undefined,
  })),
}));

import {
  getFluidSession,
  sealFluidSession,
  type FluidSession,
} from "./fluid-session";

const session = {
  user_id: 42,
  user_name: "Test User",
  company_id: 7,
  company_name: "Test Company",
} satisfies FluidSession;

describe("getFluidSession", () => {
  afterEach(() => {
    cookieValue.current = undefined;
    delete process.env.FLUID_DROPLET_SECRET;
  });

  it("rejects an unsigned cookie containing an attacker-selected identity", async () => {
    process.env.FLUID_DROPLET_SECRET = "local-test-secret";
    cookieValue.current = Buffer.from(
      JSON.stringify({
        user_id: 999,
        user_name: "Forged User",
        company_id: 123,
        company_name: "Forged Company",
      }),
    ).toString("base64");

    await expect(getFluidSession()).resolves.toBeNull();
  });

  it("returns a session sealed with the configured secret", async () => {
    process.env.FLUID_DROPLET_SECRET = "local-test-secret";
    cookieValue.current = sealFluidSession(session, "local-test-secret");

    await expect(getFluidSession()).resolves.toEqual(session);
  });

  it("rejects a session sealed with a different secret", async () => {
    process.env.FLUID_DROPLET_SECRET = "local-test-secret";
    cookieValue.current = sealFluidSession(session, "different-secret");

    await expect(getFluidSession()).resolves.toBeNull();
  });

  it("rejects a modified signed session", async () => {
    process.env.FLUID_DROPLET_SECRET = "local-test-secret";
    const sealed = sealFluidSession(session, "local-test-secret");
    const [payload, signature] = sealed.split(".");
    const modifiedPayload = Buffer.from(
      JSON.stringify({ ...session, company_id: 999 }),
    ).toString("base64url");
    cookieValue.current = `${modifiedPayload}.${signature ?? ""}`;

    expect(payload).not.toBe(modifiedPayload);
    await expect(getFluidSession()).resolves.toBeNull();
  });

  it("rejects a signed session when the server secret is absent", async () => {
    cookieValue.current = sealFluidSession(session, "local-test-secret");

    await expect(getFluidSession()).resolves.toBeNull();
  });
});
