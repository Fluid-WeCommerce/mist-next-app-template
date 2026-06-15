// Entry point for the Fluid droplet auth handshake.
//
// Visitors land here when they want to sign in with their Fluid account.
// We redirect them to Fluid's /droplet/auth endpoint with the droplet UUID
// and a callback URL. Fluid signs a JWT with the droplet's secret and
// redirects back to /api/auth/callback?token=<jwt>&return_to=<url>.
//
// Env vars (set by Mist at create time on the Vercel project):
//   FLUID_BASE_URL       — e.g. "https://www.fluid.app"
//   FLUID_DROPLET_UUID   — e.g. "drp_abc123..."
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  const fluidBase = process.env.FLUID_BASE_URL || "https://fluid.app";
  const dropletUuid = process.env.FLUID_DROPLET_UUID;
  if (!dropletUuid) {
    return new Response("FLUID_DROPLET_UUID not configured", { status: 500 });
  }

  const callbackUrl = new URL("/api/auth/callback", req.url).toString();
  const redirect = new URL(`${fluidBase}/droplet/auth`);
  redirect.searchParams.set("droplet", dropletUuid);
  redirect.searchParams.set("callback", callbackUrl);
  redirect.searchParams.set("return_to", returnTo);

  return NextResponse.redirect(redirect);
}
