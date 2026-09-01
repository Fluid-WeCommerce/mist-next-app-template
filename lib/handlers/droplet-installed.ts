// Handles the `droplet.installed` lifecycle webhook.
//
// Creates/updates the company record with the credentials Fluid issued, then
// registers every enabled feature from droplet.config.ts on the company's
// behalf and stores the resulting ids for cleanup on uninstall.

import { upsertCompany, setRegisteredIds } from "../repositories/companies";
import { registerDropletFeatures } from "../config/registration-service";
import { exchangeInstallToken } from "../fluid/client";
import { isFluidInstallationReference } from "../fluid/installation-reference";
import { ensureSchema } from "../ensure-schema";

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
    credentials?: {
      exchange_token?: string;
      exchange_endpoint?: string;
    };
  };
}

export async function handleDropletInstalled(payload: unknown): Promise<void> {
  const data = payload as InstalledPayload;
  const company = data.company;
  if (!company) throw new Error("droplet.installed: missing `company` in payload");

  let authenticationToken = company.authentication_token ?? null;
  let webhookVerificationToken = company.webhook_verification_token ?? null;
  let dropletInstallationUuid = company.droplet_installation_uuid ?? null;
  let dropletUuid = company.company_droplet_uuid ?? company.droplet_uuid ?? null;
  let fluidCompanyId = company.fluid_company_id ?? null;
  let fluidShop = company.fluid_shop ?? null;

  const exchangeToken = company.credentials?.exchange_token;
  if (!authenticationToken && exchangeToken) {
    await ensureSchema();
    const exchanged = await exchangeInstallToken(
      exchangeToken,
      company.credentials?.exchange_endpoint,
    );
    authenticationToken = exchanged.credentials.authentication_token;
    webhookVerificationToken = exchanged.credentials.webhook_verification_token;
    dropletInstallationUuid = exchanged.droplet_installation.droplet_installation_uuid;
    dropletUuid = exchanged.droplet_installation.droplet_uuid;
    fluidCompanyId = exchanged.droplet_installation.fluid_company_id;
    fluidShop = exchanged.droplet_installation.fluid_shop;
  }

  if (!isFluidInstallationReference(dropletInstallationUuid)) {
    throw new Error("droplet.installed: missing or invalid `droplet_installation_uuid`");
  }
  if (!authenticationToken) {
    throw new Error("droplet.installed: missing `authentication_token`");
  }
  if (!webhookVerificationToken) {
    throw new Error("droplet.installed: missing `webhook_verification_token`");
  }

  const saved = await upsertCompany({
    fluidCompanyId,
    fluidShop,
    name: company.name ?? null,
    // droplet_uuid is the shared droplet UUID; company_droplet_uuid may also be
    // sent — prefer whichever is present.
    companyDropletUuid: dropletUuid,
    dropletInstallationUuid,
    authenticationToken,
    webhookVerificationToken,
  });

  console.log(`[droplet.installed] company ${saved.id} (${saved.name ?? "unknown"}) active`);

  const registered = await registerDropletFeatures(authenticationToken);
  await setRegisteredIds(saved.id, registered);
  console.log(
    `[droplet.installed] registered ${registered.webhookIds?.length ?? 0} webhooks, ` +
      `${registered.callbackUuids?.length ?? 0} callbacks, ` +
      `${registered.dropZoneUuids?.length ?? 0} dropzones for company ${saved.id}`,
  );
}
