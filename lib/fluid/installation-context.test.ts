import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  deactivateCompany,
  upsertCompany,
} from "../repositories/companies";
import {
  FLUID_INSTALLATION_HEADER,
  resolveFluidInstallation,
} from "./installation-context";

describe("resolveFluidInstallation", () => {
  it("resolves the active installation named by the request DRI", async () => {
    vi.stubEnv("MIST_DEV", "1");
    const installationId = `dri_${randomUUID().replaceAll("-", "")}`;
    const installation = await upsertCompany({
      fluidCompanyId: 101,
      fluidShop: `shop-${randomUUID()}`,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: installationId,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    const request = new Request("https://droplet.example/api/private", {
      headers: { [FLUID_INSTALLATION_HEADER]: installationId },
    });

    const context = await resolveFluidInstallation(request);

    expect(context.installationId).toBe(installationId);
    expect(context.companyId).toBe(101);
    expect(context.installation.id).toBe(installation.id);
    expect(context.assurance).toBe("installation-reference");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["wrong prefix", "company_123"],
    ["empty DRI suffix", "dri_"],
    ["invalid characters", "dri_bad value"],
  ])("rejects a %s installation reference", async (_case, installationId) => {
    vi.stubEnv("MIST_DEV", "1");
    const headers = new Headers();
    if (installationId !== undefined) {
      headers.set(FLUID_INSTALLATION_HEADER, installationId);
    }
    const request = new Request("https://droplet.example/api/private", { headers });

    const resolution = resolveFluidInstallation(request);

    await expect(resolution).rejects.toBeInstanceOf(Error);
  });

  it("rejects an inactive installation", async () => {
    vi.stubEnv("MIST_DEV", "1");
    const installationId = `dri_${randomUUID().replaceAll("-", "")}`;
    await upsertCompany({
      fluidCompanyId: 303,
      fluidShop: `shop-${randomUUID()}`,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: installationId,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    await deactivateCompany({ dropletInstallationUuid: installationId });
    const request = new Request("https://droplet.example/api/private", {
      headers: { [FLUID_INSTALLATION_HEADER]: installationId },
    });

    const resolution = resolveFluidInstallation(request);

    await expect(resolution).rejects.toBeInstanceOf(Error);
  });

  it("does not fall back from an unknown DRI to a matching fluid shop", async () => {
    vi.stubEnv("MIST_DEV", "1");
    const requestedInstallationId = `dri_${randomUUID().replaceAll("-", "")}`;
    await upsertCompany({
      fluidCompanyId: 404,
      fluidShop: requestedInstallationId,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: `dri_${randomUUID().replaceAll("-", "")}`,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    const request = new Request("https://droplet.example/api/private", {
      headers: { [FLUID_INSTALLATION_HEADER]: requestedInstallationId },
    });

    const resolution = resolveFluidInstallation(request);

    await expect(resolution).rejects.toBeInstanceOf(Error);
  });

  it("rejects a stored installation identifier without the DRI prefix", async () => {
    vi.stubEnv("MIST_DEV", "1");
    const malformedInstallationId = `installation-${randomUUID()}`;
    await upsertCompany({
      fluidCompanyId: 202,
      fluidShop: `shop-${randomUUID()}`,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: malformedInstallationId,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken: `wvt_${randomUUID()}`,
    });
    const request = new Request("https://droplet.example/api/private", {
      headers: { [FLUID_INSTALLATION_HEADER]: malformedInstallationId },
    });

    const resolution = resolveFluidInstallation(request);

    await expect(resolution).rejects.toMatchObject({
      name: "FluidInstallationContextError",
      message: "Fluid installation context not found",
    });
  });
});
