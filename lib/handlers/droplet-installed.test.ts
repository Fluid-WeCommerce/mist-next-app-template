import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deactivateCompanyByInstallation,
  findActiveCompanyByShop,
  findCompany,
  upsertCompany,
} from "../repositories/companies";
import { handleDropletInstalled } from "./droplet-installed";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("handleDropletInstalled", () => {
  it("checks database readiness before consuming DEX", async () => {
    const dbCache = Symbol.for("mist.db");
    const processGlobals = globalThis as Record<PropertyKey, unknown>;
    const previousDatabase = processGlobals[dbCache];
    delete processGlobals[dbCache];
    vi.stubEnv("MIST_DEV", "0");
    vi.stubEnv("DATABASE_URL", "");
    const fetchBoundary = vi.fn(async () =>
      new Response(
        JSON.stringify({
          droplet_installation: {
            droplet_installation_uuid: "dri_readiness",
            droplet_uuid: "drp_template",
            fluid_company_id: 1_414,
            fluid_shop: "readiness-shop",
          },
          credentials: {
            authentication_token: "dit_readiness",
            webhook_verification_token: "wvt_readiness",
            issued_at: new Date().toISOString(),
            token_type: "bearer",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchBoundary);
    vi.resetModules();

    try {
      const freshHandler = await import("./droplet-installed");
      const installation = freshHandler.handleDropletInstalled({
        company: {
          credentials: {
            exchange_token: `dex_${randomUUID()}`,
            exchange_endpoint: "/api/droplet_installations/exchange",
          },
        },
      });

      await expect(installation).rejects.toThrow("DATABASE_URL is not set");
      expect(fetchBoundary).not.toHaveBeenCalled();
    } finally {
      delete processGlobals[dbCache];
      if (previousDatabase !== undefined) {
        processGlobals[dbCache] = previousDatabase;
      }
    }
  });

  it("exchanges DEX and persists the complete installation credential set", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exchangeToken = `dex_${randomUUID()}`;
    const installationId = `dri_${randomUUID().replaceAll("-", "")}`;
    const authenticationToken = `dit_${randomUUID()}`;
    const webhookVerificationToken = `wvt_${randomUUID()}`;
    const fetchBoundary = vi.fn(async () =>
      new Response(
        JSON.stringify({
          droplet_installation: {
            droplet_installation_uuid: installationId,
            droplet_uuid: "drp_template",
            fluid_company_id: 1_313,
            fluid_shop: `shop-${randomUUID()}`,
          },
          credentials: {
            authentication_token: authenticationToken,
            webhook_verification_token: webhookVerificationToken,
            issued_at: new Date().toISOString(),
            token_type: "bearer",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchBoundary);

    await handleDropletInstalled({
      company: {
        name: "Example Company",
        credentials: {
          exchange_token: exchangeToken,
          exchange_endpoint: "/api/droplet_installations/exchange",
        },
      },
    });

    const storedInstallation = await findCompany({
      dropletInstallationUuid: installationId,
    });
    expect(storedInstallation).toMatchObject({
      active: true,
      fluidCompanyId: 1_313,
      dropletInstallationUuid: installationId,
      authenticationToken,
      webhookVerificationToken,
    });
    expect(fetchBoundary).toHaveBeenCalledOnce();
  });

  it("creates a distinct row when the same shop is reinstalled with a new DRI", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fluidShop = `shop-${randomUUID()}`;
    const oldInstallationId = `dri_${randomUUID().replaceAll("-", "")}`;
    const oldInstallation = await upsertCompany({
      fluidCompanyId: 1_616,
      fluidShop,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: oldInstallationId,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    await deactivateCompanyByInstallation(oldInstallationId);
    const newInstallationId = `dri_${randomUUID().replaceAll("-", "")}`;

    await handleDropletInstalled({
      company: {
        fluid_company_id: 1_616,
        fluid_shop: fluidShop,
        company_droplet_uuid: "drp_template",
        droplet_installation_uuid: newInstallationId,
        authentication_token: `dit_${randomUUID()}`,
        webhook_verification_token: `wvt_${randomUUID()}`,
      },
    });

    const historicalInstallation = await findCompany({
      dropletInstallationUuid: oldInstallationId,
    });
    const activeInstallation = await findCompany({
      dropletInstallationUuid: newInstallationId,
    });
    expect(historicalInstallation).toMatchObject({
      id: oldInstallation.id,
      active: false,
    });
    expect(activeInstallation?.id).not.toBe(oldInstallation.id);
    expect(activeInstallation?.active).toBe(true);
  });

  it("deactivates a superseded same-shop installation when uninstall was missed", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fluidShop = `shop-${randomUUID()}`;
    const oldInstallationId = `dri_${randomUUID().replaceAll("-", "")}`;
    const oldInstallation = await upsertCompany({
      fluidCompanyId: 1_818,
      fluidShop,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: oldInstallationId,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    const newInstallationId = `dri_${randomUUID().replaceAll("-", "")}`;

    await handleDropletInstalled({
      company: {
        fluid_company_id: 1_818,
        fluid_shop: fluidShop,
        company_droplet_uuid: "drp_template",
        droplet_installation_uuid: newInstallationId,
        authentication_token: `dit_${randomUUID()}`,
        webhook_verification_token: `wvt_${randomUUID()}`,
      },
    });

    const historicalInstallation = await findCompany({
      dropletInstallationUuid: oldInstallationId,
    });
    const activeInstallation = await findActiveCompanyByShop(fluidShop);
    expect(historicalInstallation).toMatchObject({
      id: oldInstallation.id,
      active: false,
    });
    expect(activeInstallation).toMatchObject({
      dropletInstallationUuid: newInstallationId,
      active: true,
    });
  });

  it("rejects an install payload without a valid DRI", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const installation = handleDropletInstalled({
      company: {
        fluid_company_id: 1_010,
        fluid_shop: `shop-${randomUUID()}`,
        company_droplet_uuid: "drp_template",
        authentication_token: `dit_${randomUUID()}`,
        webhook_verification_token: `wvt_${randomUUID()}`,
      },
    });

    await expect(installation).rejects.toThrow(
      "droplet.installed: missing or invalid `droplet_installation_uuid`",
    );
  });

  it("rejects an install payload without a webhook verification credential", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const installation = handleDropletInstalled({
      company: {
        fluid_company_id: 1_212,
        fluid_shop: `shop-${randomUUID()}`,
        company_droplet_uuid: "drp_template",
        droplet_installation_uuid: `dri_${randomUUID().replaceAll("-", "")}`,
        authentication_token: `dit_${randomUUID()}`,
      },
    });

    await expect(installation).rejects.toThrow(
      "droplet.installed: missing `webhook_verification_token`",
    );
  });

  it("rejects an install payload without a DIT", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const installation = handleDropletInstalled({
      company: {
        fluid_company_id: 1_111,
        fluid_shop: `shop-${randomUUID()}`,
        company_droplet_uuid: "drp_template",
        droplet_installation_uuid: `dri_${randomUUID().replaceAll("-", "")}`,
        webhook_verification_token: `wvt_${randomUUID()}`,
      },
    });

    await expect(installation).rejects.toThrow(
      "droplet.installed: missing `authentication_token`",
    );
  });
});
