// Registration service.
//
// On install, walks the declarative droplet config and registers every enabled
// webhook, callback, and drop zone with Fluid on the installing company's
// behalf. Returns the created ids so they can be persisted and later cleaned up.
// Failures are logged and skipped — one bad registration never aborts install.

import { FluidClient } from "../fluid/client";
import { getAppBaseUrl } from "../app-url";
import type { RegisteredIds } from "../schema";
import { getWebhookAuthToken } from "../webhook-auth-token";
import { dropletConfig } from "./droplet.config";

export async function registerDropletFeatures(authToken: string): Promise<RegisteredIds> {
  const client = new FluidClient(authToken);
  const baseUrl = getAppBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks`;
  const webhookAuthToken = getWebhookAuthToken() || "";

  const registered: RegisteredIds = {
    webhookIds: [],
    callbackUuids: [],
    dropZoneUuids: [],
  };

  for (const webhook of dropletConfig.webhooks.filter((w) => w.enabled)) {
    await isolate(`webhook ${webhook.resource}.${webhook.event}`, async () => {
      const res = await client.createWebhook({
        resource: webhook.resource,
        event: webhook.event,
        url: webhookUrl,
        auth_token: webhookAuthToken,
      });
      registered.webhookIds.push(String(res.webhook.id));
    });
  }

  for (const callback of dropletConfig.callbacks.filter((c) => c.enabled)) {
    await isolate(`callback ${callback.definition_name}`, async () => {
      const res = await client.createCallback({
        definition_name: callback.definition_name,
        url: `${baseUrl}${callback.url}`,
      });
      registered.callbackUuids.push(res.callback_registration.uuid);
    });
  }

  for (const dropzone of dropletConfig.dropzones.filter((d) => d.enabled)) {
    await isolate(`dropzone ${dropzone.uuid}`, async () => {
      const res = await client.createDropZone({
        name: dropzone.name,
        uuid: dropzone.uuid,
        settings: { page: dropzone.page, zone: dropzone.zone, priority: dropzone.priority },
        embed_url: `${baseUrl}${dropzone.embedPath}`,
      });
      registered.dropZoneUuids.push(res.drop_zone.uuid || dropzone.uuid);
    });
  }

  return registered;
}

// Runs one registration best-effort: a failure is logged and skipped so a
// single bad feature never aborts the whole install.
async function isolate(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[register] ${label} failed:`, err);
  }
}
