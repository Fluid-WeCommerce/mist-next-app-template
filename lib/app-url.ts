// Resolves this droplet's public base URL for building callback/webhook URLs
// that Fluid will call back into.
//
// Priority: explicit APP_URL / FLUID_DROPLET_URL → Vercel's stable production
// URL → deployment URL fallback → localhost for dev. Registrations persist in
// Fluid, so they must not point at one immutable preview/deployment hostname
// when Vercel exposes the project's durable production domain.
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_URL || process.env.FLUID_DROPLET_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

// Base URL for the Fluid API (outbound calls). Overridable via FLUID_API_URL.
export function getFluidApiUrl(): string {
  return process.env.FLUID_API_URL || "https://api.fluid.app";
}
