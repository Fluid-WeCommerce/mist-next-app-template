// Handles the `droplet.uninstalled` lifecycle webhook.
//
// Deactivates the company record and removes every Fluid registration created
// on install. Cleanup failures retain credentials and IDs so webhook redelivery
// can retry; credentials are erased only after complete cleanup.

import {
  deactivateCompanyByInstallation,
  eraseCompanyCredentials,
} from "../repositories/companies";
import { cleanupDropletFeatures } from "../config/cleanup-service";
import { isFluidInstallationReference } from "../fluid/installation-reference";

interface UninstalledPayload {
  company?: {
    droplet_installation_uuid?: string;
  };
}

export async function handleDropletUninstalled(payload: unknown): Promise<void> {
  const data = payload as UninstalledPayload;
  const company = data.company;
  if (!company) throw new Error("droplet.uninstalled: missing `company` in payload");

  const installationId = company.droplet_installation_uuid ?? null;
  if (!isFluidInstallationReference(installationId)) {
    throw new Error("droplet.uninstalled: missing or invalid `droplet_installation_uuid`");
  }

  const deactivated = await deactivateCompanyByInstallation(installationId);

  if (!deactivated) {
    console.warn("[droplet.uninstalled] no matching company found; nothing to do");
    return;
  }

  console.log(`[droplet.uninstalled] company ${deactivated.id} deactivated`);

  if (deactivated.authenticationToken) {
    await cleanupDropletFeatures(deactivated.authenticationToken, deactivated.registeredIds);
  }

  await eraseCompanyCredentials(deactivated.id);
}
