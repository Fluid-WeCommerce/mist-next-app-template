import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppBaseUrl } from "./app-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppBaseUrl", () => {
  it("prefers an explicitly configured app URL", () => {
    vi.stubEnv("APP_URL", "https://mist.example.com/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "stable.vercel.app");
    vi.stubEnv("VERCEL_URL", "deployment-abc.vercel.app");

    expect(getAppBaseUrl()).toBe("https://mist.example.com");
  });

  it("uses the stable Vercel production domain for persisted registrations", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("FLUID_DROPLET_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "mist.example.com");
    vi.stubEnv("VERCEL_URL", "mist-git-abc-team.vercel.app");

    expect(getAppBaseUrl()).toBe("https://mist.example.com");
  });

  it("falls back to the deployment URL when no production domain is exposed", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("FLUID_DROPLET_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "mist-deployment.vercel.app");

    expect(getAppBaseUrl()).toBe("https://mist-deployment.vercel.app");
  });

  it("uses localhost outside a configured deployment", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("FLUID_DROPLET_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });
});
