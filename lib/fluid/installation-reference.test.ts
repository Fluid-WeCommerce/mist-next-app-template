import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FLUID_INSTALLATION_HEADER,
  fluidInstallationFetch,
  readFluidInstallationReference,
} from "./installation-reference";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readFluidInstallationReference", () => {
  it("reads a valid DRI from the iframe bootstrap URL", () => {
    const installationId = "dri_01templateinstall";

    const reference = readFluidInstallationReference(
      `https://droplet.example/?dri=${installationId}`,
    );

    expect(reference).toBe(installationId);
  });

  it.each([
    ["missing DRI", "https://droplet.example/"],
    ["empty DRI", "https://droplet.example/?dri="],
    ["wrong prefix", "https://droplet.example/?dri=company_123"],
    ["invalid DRI characters", "https://droplet.example/?dri=dri_bad%20value"],
    ["malformed URL", "not a URL"],
  ])("returns null for %s", (_case, url) => {
    expect(readFluidInstallationReference(url)).toBeNull();
  });
});

describe("fluidInstallationFetch", () => {
  it("adds the DRI header while preserving caller headers", async () => {
    const outboundRequests: Array<{
      input: RequestInfo | URL;
      init?: RequestInit;
    }> = [];
    const fetchBoundary = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        outboundRequests.push({ input, init });
        return new Response(null, { status: 204 });
      },
    );

    await fluidInstallationFetch(
      "dri_01templateinstall",
      "/api/private",
      { headers: { "X-Request-Id": "request-123" } },
      fetchBoundary,
    );

    expect(outboundRequests).toHaveLength(1);
    expect(outboundRequests[0].input).toBe("/api/private");
    const headers = new Headers(outboundRequests[0].init?.headers);
    expect(headers.get(FLUID_INSTALLATION_HEADER)).toBe("dri_01templateinstall");
    expect(headers.get("X-Request-Id")).toBe("request-123");
  });

  it("preserves headers already present on a Request input", async () => {
    const outboundRequests: RequestInit[] = [];
    const fetchBoundary = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        outboundRequests.push(init ?? {});
        return new Response(null, { status: 204 });
      },
    );
    vi.stubGlobal("location", { origin: "https://droplet.example" });
    const input = new Request("https://droplet.example/api/private", {
      headers: { "If-Match": "resource-version" },
    });

    await fluidInstallationFetch(
      "dri_expected",
      input,
      undefined,
      fetchBoundary,
    );

    const headers = new Headers(outboundRequests[0].headers);
    expect(headers.get("If-Match")).toBe("resource-version");
    expect(headers.get(FLUID_INSTALLATION_HEADER)).toBe("dri_expected");
  });

  it("rejects a cross-origin target before disclosing the DRI", async () => {
    vi.stubGlobal("location", { origin: "https://droplet.example" });
    const fetchBoundary = vi.fn<typeof fetch>();

    const request = fluidInstallationFetch(
      "dri_expected",
      "https://third-party.example/collect",
      undefined,
      fetchBoundary,
    );

    await expect(request).rejects.toThrow(
      "Fluid installation fetch must stay on the current origin",
    );
    expect(fetchBoundary).not.toHaveBeenCalled();
  });

  it("rejects a malformed DRI before making a request", async () => {
    const fetchBoundary = vi.fn<typeof fetch>();

    const request = fluidInstallationFetch(
      "company_123",
      "/api/private",
      undefined,
      fetchBoundary,
    );

    await expect(request).rejects.toThrow(
      "Fluid installation reference is unavailable",
    );
    expect(fetchBoundary).not.toHaveBeenCalled();
  });

  it("overwrites a caller-supplied installation header", async () => {
    const outboundRequests: RequestInit[] = [];
    const fetchBoundary = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        outboundRequests.push(init ?? {});
        return new Response(null, { status: 204 });
      },
    );

    await fluidInstallationFetch(
      "dri_expected",
      "/api/private",
      { headers: { [FLUID_INSTALLATION_HEADER]: "dri_spoofed" } },
      fetchBoundary,
    );

    const headers = new Headers(outboundRequests[0].headers);
    expect(headers.get(FLUID_INSTALLATION_HEADER)).toBe("dri_expected");
  });
});
