// Handles the `droplet.uninstalled` lifecycle webhook.
//
// Deactivates the company record and best-effort removes every Fluid
// registration created on install. Deactivation is idempotent — a repeated
// uninstall webhook is a no-op.

import { deactivateCompany } from "../repositories/companies";
import { cleanupDropletFeatures } from "../config/cleanup-service";

interface UninstalledPayload {
  company?: {
    fluid_shop?: string;
    droplet_installation_uuid?: string;
  };
}

export async function handleDropletUninstalled(payload: unknown): Promise<void> {
  const data = payload as UninstalledPayload;
  const company = data.company;
  if (!company) throw new Error("droplet.uninstalled: missing `company` in payload");

  const deactivated = await deactivateCompany({
    dropletInstallationUuid: company.droplet_installation_uuid ?? null,
    fluidShop: company.fluid_shop ?? null,
  });

  if (!deactivated) {
    console.warn("[droplet.uninstalled] no matching company found; nothing to do");
    return;
  }

  console.log(`[droplet.uninstalled] company ${deactivated.id} deactivated`);

  if (deactivated.authenticationToken) {
    await cleanupDropletFeatures(deactivated.authenticationToken, deactivated.registeredIds);
  }
}
