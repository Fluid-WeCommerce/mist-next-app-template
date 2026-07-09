// Types for the declarative droplet configuration (lib/config/droplet.config.ts).
//
// You declare which webhooks, callbacks, and drop zones your droplet needs.
// On install the registration service creates every `enabled` entry with Fluid;
// on uninstall the cleanup service removes them. Flip `enabled` to turn a
// feature on or off — no other code changes needed.

export interface WebhookConfig {
  enabled: boolean;
  resource: string;
  event: string;
  description?: string;
}

export interface CallbackConfig {
  enabled: boolean;
  // Must match a callback definition (YAML) registered in Fluid.
  definition_name: string;
  // Path on this droplet that Fluid will call, e.g. "/api/callbacks/adjust".
  url: string;
  description?: string;
}

export interface DropZoneConfig {
  enabled: boolean;
  uuid: string;
  name: string;
  page: string;
  zone: string;
  priority?: number;
  // Path on this droplet rendered inside the drop zone iframe.
  embedPath: string;
  description?: string;
}

export interface DropletConfig {
  webhooks: WebhookConfig[];
  callbacks: CallbackConfig[];
  dropzones: DropZoneConfig[];
}
