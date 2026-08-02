import { afterEach, describe, expect, it, vi } from "vitest";

const DB_CACHE = Symbol.for("mist.db");

afterEach(() => {
  delete (globalThis as Record<PropertyKey, unknown>)[DB_CACHE];
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("db", () => {
  it("shares the local client across separate server bundles", async () => {
    vi.stubEnv("MIST_DEV", "1");

    const firstBundle = await import("./db");
    const firstClient = await firstBundle.db();

    vi.resetModules();

    const secondBundle = await import("./db");
    const secondClient = await secondBundle.db();

    expect(secondClient).toBe(firstClient);
  });
});
