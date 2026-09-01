// Registration service.
//
// Registers enabled features sequentially and reports each successful creation
// so install handling can persist progress before acknowledging the lifecycle
// event. Redelivery resumes from the stored prefix instead of recreating it.

import { FluidClient } from "../fluid/client";
import { getAppBaseUrl } from "../app-url";
import type { RegisteredIds } from "../schema";
import { getWebhookAuthToken } from "../webhook-auth-token";
import { dropletConfig } from "./droplet.config";

const emptyRegisteredIds = (): RegisteredIds => ({
  webhookIds: [],
  callbackUuids: [],
  dropZoneUuids: [],
});

export async function registerDropletFeatures(
  authToken: string,
  existing: RegisteredIds | null | undefined = null,
  onProgress?: (registered: RegisteredIds) => Promise<void>,
): Promise<RegisteredIds> {
  const client = new FluidClient(authToken);
  const baseUrl = getAppBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks`;
  const webhookAuthToken = getWebhookAuthToken() || "";
  const registered = existing
    ? {
        webhookIds: [...existing.webhookIds],
        callbackUuids: [...existing.callbackUuids],
        dropZoneUuids: [...existing.dropZoneUuids],
      }
    : emptyRegisteredIds();

  const webhooks = dropletConfig.webhooks.filter((webhook) => webhook.enabled);
  for (let index = registered.webhookIds.length; index < webhooks.length; index += 1) {
    const webhook = webhooks[index];
    const response = await client.createWebhook({
      resource: webhook.resource,
      event: webhook.event,
      url: webhookUrl,
      auth_token: webhookAuthToken,
    });
    registered.webhookIds.push(String(response.webhook.id));
    await onProgress?.(cloneRegisteredIds(registered));
  }

  const callbacks = dropletConfig.callbacks.filter((callback) => callback.enabled);
  for (
    let index = registered.callbackUuids.length;
    index < callbacks.length;
    index += 1
  ) {
    const callback = callbacks[index];
    const response = await client.createCallback({
      definition_name: callback.definition_name,
      url: `${baseUrl}${callback.url}`,
    });
    registered.callbackUuids.push(response.callback_registration.uuid);
    await onProgress?.(cloneRegisteredIds(registered));
  }

  const dropzones = dropletConfig.dropzones.filter((dropzone) => dropzone.enabled);
  for (
    let index = registered.dropZoneUuids.length;
    index < dropzones.length;
    index += 1
  ) {
    const dropzone = dropzones[index];
    const response = await client.createDropZone({
      name: dropzone.name,
      uuid: dropzone.uuid,
      settings: {
        page: dropzone.page,
        zone: dropzone.zone,
        priority: dropzone.priority,
      },
      embed_url: `${baseUrl}${dropzone.embedPath}`,
    });
    registered.dropZoneUuids.push(response.drop_zone.uuid || dropzone.uuid);
    await onProgress?.(cloneRegisteredIds(registered));
  }

  return registered;
}

function cloneRegisteredIds(registered: RegisteredIds): RegisteredIds {
  return {
    webhookIds: [...registered.webhookIds],
    callbackUuids: [...registered.callbackUuids],
    dropZoneUuids: [...registered.dropZoneUuids],
  };
}
