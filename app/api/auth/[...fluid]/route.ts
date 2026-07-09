// Fluid droplet auth callback. The handshake starts at /droplet/connect,
// which redirects to Fluid's /droplet/auth endpoint. Fluid signs a JWT with
// the droplet's secret and redirects back here as:
//
//   GET /api/auth/callback?token=<jwt>&return_to=<url>
//
// We verify the JWT's HMAC signature with FLUID_DROPLET_SECRET, set a session
// cookie, and redirect to return_to.
//
// Env vars (set by Mist at create time on the Vercel project):
//   FLUID_DROPLET_SECRET — HMAC key for verifying the JWT signature
import { NextRequest, NextResponse } from "next/server";
import { verifyFluidJwt } from "@/lib/jwt";
import type { FluidSession } from "@/lib/fluid-session";

// node:crypto (used by verifyFluidJwt) needs the Node runtime.
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fluid: string[] }> },
) {
  const { fluid } = await params;
  const action = fluid[0];

  if (action === "callback") return completeHandshake(req);
  return new Response("Unknown auth action", { status: 404 });
}

function completeHandshake(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  if (!token) return new Response("Missing token", { status: 400 });

  const secret = process.env.FLUID_DROPLET_SECRET;
  if (!secret) {
    console.error("[auth] FLUID_DROPLET_SECRET not configured");
    return new Response("Auth not configured", { status: 500 });
  }

  const result = verifyFluidJwt<FluidSession>(token, secret);
  if (!result.valid || !result.payload) {
    console.warn(`[auth] rejected token: ${result.error}`);
    return new Response("Invalid token", { status: 401 });
  }

  const { user_id, user_name, company_id, company_name } = result.payload;
  const session: FluidSession = { user_id, user_name, company_id, company_name };

  const sessionCookie = Buffer.from(JSON.stringify(session)).toString("base64");
  const res = NextResponse.redirect(new URL(returnTo, req.url));
  res.cookies.set("mist_session", sessionCookie, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
  });
  return res;
}
