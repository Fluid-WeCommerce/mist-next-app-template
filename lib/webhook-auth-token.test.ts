import { afterEach, describe, expect, it } from "vitest";
import { getWebhookAuthToken } from "./webhook-auth-token";

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getWebhookAuthToken", () => {
  it("prefers FLUID_WEBHOOK_AUTH_TOKEN when set", () => {
    process.env = {
      ...ORIGINAL_ENV,
      FLUID_WEBHOOK_AUTH_TOKEN: "webhook-token",
      FLUID_DROPLET_SECRET: "droplet-secret",
    };

    expect(getWebhookAuthToken()).toBe("webhook-token");
  });

  it("falls back to FLUID_DROPLET_SECRET for existing Mist deployments", () => {
    process.env = {
      ...ORIGINAL_ENV,
      FLUID_WEBHOOK_AUTH_TOKEN: "",
      FLUID_DROPLET_SECRET: "droplet-secret",
    };

    expect(getWebhookAuthToken()).toBe("droplet-secret");
  });

  it("returns undefined when neither env var is set", () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.FLUID_WEBHOOK_AUTH_TOKEN;
    delete process.env.FLUID_DROPLET_SECRET;

    expect(getWebhookAuthToken()).toBeUndefined();
  });
});
