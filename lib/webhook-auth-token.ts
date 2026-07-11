// Resolves the shared secret used for lifecycle webhook verification and the
// legacy AUTH_TOKEN fallback for company webhooks.
//
// New Mist deployments receive FLUID_WEBHOOK_AUTH_TOKEN explicitly. Existing
// Mist deployments created before that env var existed already have the same
// per-droplet secret as FLUID_DROPLET_SECRET, so fall back to it for backwards
// compatibility.
export function getWebhookAuthToken(): string | undefined {
  return process.env.FLUID_WEBHOOK_AUTH_TOKEN || process.env.FLUID_DROPLET_SECRET || undefined;
}

export const WEBHOOK_AUTH_TOKEN_ENV_DESCRIPTION =
  "FLUID_WEBHOOK_AUTH_TOKEN or FLUID_DROPLET_SECRET";
