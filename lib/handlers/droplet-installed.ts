// Handles the `droplet.installed` lifecycle webhook.
//
// Creates/updates the company record with the credentials Fluid issued, then
// registers every enabled feature from droplet.config.ts on the company's
// behalf and stores the resulting ids for cleanup on uninstall.

import { upsertCompany, setRegisteredIds } from "../repositories/companies";
import { registerDropletFeatures } from "../config/registration-service";

interface InstalledPayload {
  company?: {
    fluid_shop?: string;
    name?: string;
    fluid_company_id?: number;
    company_droplet_uuid?: string;
    droplet_uuid?: string;
    droplet_installation_uuid?: string;
    authentication_token?: string;
    webhook_verification_token?: string;
  };
}

export async function handleDropletInstalled(payload: unknown): Promise<void> {
  const data = payload as InstalledPayload;
  const company = data.company;
  if (!company) throw new Error("droplet.installed: missing `company` in payload");

  const authenticationToken = company.authentication_token ?? null;

  const saved = await upsertCompany({
    fluidCompanyId: company.fluid_company_id ?? null,
    fluidShop: company.fluid_shop ?? null,
    name: company.name ?? null,
    // droplet_uuid is the shared droplet UUID; company_droplet_uuid may also be
    // sent — prefer whichever is present.
    companyDropletUuid: company.company_droplet_uuid ?? company.droplet_uuid ?? null,
    dropletInstallationUuid: company.droplet_installation_uuid ?? null,
    authenticationToken,
    webhookVerificationToken: company.webhook_verification_token ?? null,
  });

  console.log(`[droplet.installed] company ${saved.id} (${saved.name ?? "unknown"}) active`);

  if (!authenticationToken) {
    console.warn(
      `[droplet.installed] company ${saved.id} has no authentication_token; skipping feature registration`,
    );
    return;
  }

  const registered = await registerDropletFeatures(authenticationToken);
  await setRegisteredIds(saved.id, registered);
  console.log(
    `[droplet.installed] registered ${registered.webhookIds?.length ?? 0} webhooks, ` +
      `${registered.callbackUuids?.length ?? 0} callbacks, ` +
      `${registered.dropZoneUuids?.length ?? 0} dropzones for company ${saved.id}`,
  );
}
