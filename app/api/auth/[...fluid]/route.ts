// Fluid droplet auth handshake. Two phases:
//
//   GET /api/auth/start?return_to=<url>
//     Redirect the visitor to Fluid's /droplet/auth endpoint with the droplet
//     UUID and callback URL. Fluid signs a JWT using the droplet's secret and
//     redirects back to /api/auth/callback?token=<jwt>&return_to=<url>.
//
//   GET /api/auth/callback?token=<jwt>&return_to=<url>
//     Validate the JWT, set a session cookie, redirect to return_to.
//
// Env vars expected (set by Mist at create time on the Vercel project):
//   FLUID_BASE_URL        — e.g. "https://www.fluid.app"
//   FLUID_DROPLET_UUID    — e.g. "drp_abc123..."
//   FLUID_DROPLET_SECRET  — for verifying the JWT signature

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fluid: string[] }> },
) {
  const { fluid } = await params;
  const action = fluid[0];

  if (action === "start") return startHandshake(req);
  if (action === "callback") return completeHandshake(req);
  return new Response("Unknown auth action", { status: 404 });
}

function startHandshake(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  const fluidBase = process.env.FLUID_BASE_URL || "https://fluid.app";
  const dropletUuid = process.env.FLUID_DROPLET_UUID;
  if (!dropletUuid) return new Response("FLUID_DROPLET_UUID not configured", { status: 500 });

  const callbackUrl = new URL("/api/auth/callback", req.url).toString();
  const redirect = new URL(`${fluidBase}/droplet/auth`);
  redirect.searchParams.set("droplet", dropletUuid);
  redirect.searchParams.set("callback", callbackUrl);
  redirect.searchParams.set("return_to", returnTo);

  return NextResponse.redirect(redirect);
}

function completeHandshake(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  if (!token) return new Response("Missing token", { status: 400 });

  // TODO Phase 002: real JWT verification using FLUID_DROPLET_SECRET (HMAC).
  // For now we trust the token's shape and decode the embedded session.
  const session = decodeUnverified(token);
  if (!session) return new Response("Invalid token", { status: 401 });

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

function decodeUnverified(jwt: string): Record<string, unknown> | null {
  try {
    const [ , payload ] = jwt.split(".");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}
