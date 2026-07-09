// Cleanup service.
//
// On uninstall, removes every Fluid registration that was created for a company
// on install (webhooks, callbacks, drop zones). Best-effort: each delete is
// isolated so one failure doesn't block the rest.

import { FluidClient } from "../fluid/client";
import type { RegisteredIds } from "../schema";

export async function cleanupDropletFeatures(
  authToken: string,
  registered: RegisteredIds | null | undefined,
): Promise<void> {
  if (!registered) return;
  const client = new FluidClient(authToken);

  for (const webhookId of registered.webhookIds ?? []) {
    try {
      await client.deleteWebhook(webhookId);
    } catch (err) {
      console.error(`[cleanup] webhook ${webhookId} failed:`, err);
    }
  }

  for (const callbackUuid of registered.callbackUuids ?? []) {
    try {
      await client.deleteCallback(callbackUuid);
    } catch (err) {
      console.error(`[cleanup] callback ${callbackUuid} failed:`, err);
    }
  }

  for (const dropZoneUuid of registered.dropZoneUuids ?? []) {
    try {
      await client.deleteDropZone(dropZoneUuid);
    } catch (err) {
      console.error(`[cleanup] dropzone ${dropZoneUuid} failed:`, err);
    }
  }
}
