// Cleanup service.
//
// On uninstall, removes every Fluid registration that was created for a company
// on install. Every deletion is attempted; real failures are reported together
// so the lifecycle webhook can retry with the retained installation DIT.

import { FluidApiError, FluidClient } from "../fluid/client";
import type { RegisteredIds } from "../schema";

export async function cleanupDropletFeatures(
  authToken: string,
  registered: RegisteredIds | null | undefined,
): Promise<void> {
  if (!registered) return;
  const client = new FluidClient(authToken);
  const failures: Error[] = [];

  await deleteEach("webhook", registered.webhookIds, failures, (id) =>
    client.deleteWebhook(id),
  );
  await deleteEach("callback", registered.callbackUuids, failures, (id) =>
    client.deleteCallback(id),
  );
  await deleteEach("dropzone", registered.dropZoneUuids, failures, (id) =>
    client.deleteDropZone(id),
  );

  if (failures.length > 0) {
    throw new AggregateError(failures, "Droplet feature cleanup failed");
  }
}

async function deleteEach(
  label: string,
  ids: string[],
  failures: Error[],
  remove: (id: string) => Promise<void>,
): Promise<void> {
  for (const id of ids) {
    try {
      await remove(id);
    } catch (error) {
      if (error instanceof FluidApiError && error.status === 404) continue;
      const failure =
        error instanceof Error ? error : new Error("Unknown cleanup failure");
      console.error(`[cleanup] ${label} ${id} failed:`, failure);
      failures.push(failure);
    }
  }
}
