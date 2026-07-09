// Resolves this droplet's public base URL for building callback/webhook URLs
// that Fluid will call back into.
//
// Priority: explicit APP_URL / FLUID_DROPLET_URL → Vercel's deployment URL →
// localhost fallback for dev.
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_URL || process.env.FLUID_DROPLET_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}
