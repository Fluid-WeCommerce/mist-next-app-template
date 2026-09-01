import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findCompany,
  setRegisteredIds,
  upsertCompany,
} from "../repositories/companies";
import { handleDropletUninstalled } from "./droplet-uninstalled";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("handleDropletUninstalled", () => {
  it("cleans up with the installation DIT and then erases retained credentials", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const installationId = `dri_${randomUUID().replaceAll("-", "")}`;
    const authenticationToken = `dit_${randomUUID()}`;
    const webhookVerificationToken = `wvt_${randomUUID()}`;
    const installation = await upsertCompany({
      fluidCompanyId: 808,
      fluidShop: `shop-${randomUUID()}`,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: installationId,
      authenticationToken,
      webhookVerificationToken,
    });
    await setRegisteredIds(installation.id, {
      webhookIds: ["webhook-123"],
      callbackUuids: [],
      dropZoneUuids: [],
    });
    const outboundRequests: RequestInit[] = [];
    const fetchBoundary = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        outboundRequests.push(init ?? {});
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchBoundary);

    await handleDropletUninstalled({
      company: { droplet_installation_uuid: installationId },
    });

    const storedInstallation = await findCompany({
      dropletInstallationUuid: installationId,
    });
    expect(storedInstallation?.active).toBe(false);
    expect(storedInstallation?.authenticationToken).toBeNull();
    expect(storedInstallation?.webhookVerificationToken).toBeNull();
    expect(fetchBoundary).toHaveBeenCalledOnce();
    expect(new Headers(outboundRequests[0].headers).get("Authorization")).toBe(
      `Bearer ${authenticationToken}`,
    );
  });

  it("does not fall back from an unknown DRI to a matching fluid shop", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storedInstallationId = `dri_${randomUUID().replaceAll("-", "")}`;
    const fluidShop = `shop-${randomUUID()}`;
    await upsertCompany({
      fluidCompanyId: 909,
      fluidShop,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: storedInstallationId,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });

    await handleDropletUninstalled({
      company: {
        droplet_installation_uuid: `dri_${randomUUID().replaceAll("-", "")}`,
        fluid_shop: fluidShop,
      },
    });

    const storedInstallation = await findCompany({
      dropletInstallationUuid: storedInstallationId,
    });
    expect(storedInstallation?.active).toBe(true);
  });
});
