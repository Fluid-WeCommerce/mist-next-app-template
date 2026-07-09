// Handler registry.
//
// Wire event types to handlers here. initializeHandlers() is called once by the
// webhook route on module load. To add a handler: write it under lib/handlers/,
// register it below, and (for company-specific webhooks) enable the matching
// entry in lib/config/droplet.config.ts so it's registered with Fluid on install.

import { registerHandler } from "../events";
import { handleDropletInstalled } from "./droplet-installed";
import { handleDropletUninstalled } from "./droplet-uninstalled";

let initialized = false;

export function initializeHandlers(): void {
  if (initialized) return;
  initialized = true;

  registerHandler("droplet.installed", handleDropletInstalled);
  registerHandler("droplet.uninstalled", handleDropletUninstalled);

  // Example: register your own handlers here.
  // registerHandler("order.created", handleOrderCreated);
}

export { handleDropletInstalled, handleDropletUninstalled };
