// Registration service.
//
// On install, walks the declarative droplet config and registers every enabled
// webhook, callback, and drop zone with Fluid on the installing company's
// behalf. Returns the created ids so they can be persisted and later cleaned up.
// Failures are logged and skipped — one bad registration never aborts install.

import { FluidClient } from "../fluid/client";
import { getAppBaseUrl } from "../app-url";
import type { RegisteredIds } from "../schema";
import { dropletConfig } from "./droplet.config";

export async function registerDropletFeatures(authToken: string): Promise<RegisteredIds> {
  const client = new FluidClient(authToken);
  const baseUrl = getAppBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks`;
  const webhookAuthToken = process.env.FLUID_WEBHOOK_AUTH_TOKEN || "";

  const registered: RegisteredIds = {
    webhookIds: [],
    callbackUuids: [],
    dropZoneUuids: [],
  };

  for (const webhook of dropletConfig.webhooks.filter((w) => w.enabled)) {
    try {
      const res = await client.createWebhook({
        resource: webhook.resource,
        event: webhook.event,
        url: webhookUrl,
        auth_token: webhookAuthToken,
        http_method: "post",
      });
      registered.webhookIds!.push(String(res.webhook.id));
    } catch (err) {
      console.error(
        `[register] webhook ${webhook.resource}.${webhook.event} failed:`,
        err,
      );
    }
  }

  for (const callback of dropletConfig.callbacks.filter((c) => c.enabled)) {
    try {
      const res = await client.createCallback({
        definition_name: callback.definition_name,
        url: `${baseUrl}${callback.url}`,
      });
      registered.callbackUuids!.push(res.callback_registration.uuid);
    } catch (err) {
      console.error(`[register] callback ${callback.definition_name} failed:`, err);
    }
  }

  for (const dropzone of dropletConfig.dropzones.filter((d) => d.enabled)) {
    try {
      const res = await client.createDropZone({
        name: dropzone.name,
        uuid: dropzone.uuid,
        settings: { page: dropzone.page, zone: dropzone.zone, priority: dropzone.priority },
        embed_url: `${baseUrl}${dropzone.embedPath}`,
      });
      const uuid = res.drop_zone.uuid || dropzone.uuid;
      registered.dropZoneUuids!.push(uuid);
    } catch (err) {
      console.error(`[register] dropzone ${dropzone.uuid} failed:`, err);
    }
  }

  return registered;
}
