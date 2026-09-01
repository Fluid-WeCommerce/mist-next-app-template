import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deactivateCompanyByInstallation,
  upsertCompany,
} from "../repositories/companies";
import { createFluidClientForInstallation, FluidClient } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FluidClient", () => {
  it("accepts an empty successful delete response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    const fluid = new FluidClient("dit_installation", "https://api.example");

    await expect(fluid.deleteWebhook("webhook-123")).resolves.toBeUndefined();
  });
});

describe("createFluidClientForInstallation", () => {
  it("authenticates Fluid API requests with the resolved installation DIT", async () => {
    vi.stubEnv("MIST_DEV", "1");
    const authenticationToken = `dit_${randomUUID()}`;
    const installation = await upsertCompany({
      fluidCompanyId: 505,
      fluidShop: `shop-${randomUUID()}`,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: `dri_${randomUUID().replaceAll("-", "")}`,
      authenticationToken,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    const outboundRequests: RequestInit[] = [];
    const fetchBoundary = vi.fn(
      async (_input: RequestInfo | URL, request?: RequestInit) => {
        outboundRequests.push(request ?? {});
        return new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchBoundary);

    const fluid = createFluidClientForInstallation(installation);
    await fluid.listWebhooks();

    expect(fetchBoundary).toHaveBeenCalledOnce();
    expect(new Headers(outboundRequests[0].headers).get("Authorization")).toBe(
      `Bearer ${authenticationToken}`,
    );
  });

  it("does not fall back to a global token when the installation has no DIT", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.stubEnv("FLUID_API_TOKEN", `shared_${randomUUID()}`);
    const installation = await upsertCompany({
      fluidCompanyId: 707,
      fluidShop: `shop-${randomUUID()}`,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: `dri_${randomUUID().replaceAll("-", "")}`,
      authenticationToken: null,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });

    const createClient = () => createFluidClientForInstallation(installation);

    expect(createClient).toThrow("Fluid installation credential is unavailable");
  });

  it("rejects an inactive installation even when its DIT remains present", async () => {
    vi.stubEnv("MIST_DEV", "1");
    const installationId = `dri_${randomUUID().replaceAll("-", "")}`;
    await upsertCompany({
      fluidCompanyId: 606,
      fluidShop: `shop-${randomUUID()}`,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: installationId,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    const inactiveInstallation = await deactivateCompanyByInstallation(
      installationId,
    );
    expect(inactiveInstallation).not.toBeNull();

    const createClient = () =>
      createFluidClientForInstallation(inactiveInstallation!);

    expect(createClient).toThrow("Fluid installation credential is unavailable");
  });
});
