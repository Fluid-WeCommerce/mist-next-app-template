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

  await deleteEach("webhook", registered.webhookIds, (id) => client.deleteWebhook(id));
  await deleteEach("callback", registered.callbackUuids, (id) => client.deleteCallback(id));
  await deleteEach("dropzone", registered.dropZoneUuids, (id) => client.deleteDropZone(id));
}

// Deletes each id best-effort: one failure is logged and skipped, never
// blocking the rest of the cleanup.
async function deleteEach(
  label: string,
  ids: string[],
  del: (id: string) => Promise<void>,
): Promise<void> {
  for (const id of ids) {
    try {
      await del(id);
    } catch (err) {
      console.error(`[cleanup] ${label} ${id} failed:`, err);
    }
  }
}
