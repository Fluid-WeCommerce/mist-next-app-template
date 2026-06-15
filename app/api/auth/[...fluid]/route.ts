// Fluid droplet auth callback. The handshake starts at /droplet/connect,
// which redirects to Fluid's /droplet/auth endpoint. Fluid signs a JWT with
// the droplet's secret and redirects back here as:
//
//   GET /api/auth/callback?token=<jwt>&return_to=<url>
//
// We validate the JWT, set a session cookie, and redirect to return_to.
//
// Env vars (set by Mist at create time on the Vercel project):
//   FLUID_DROPLET_SECRET — for verifying the JWT signature
import { NextRequest, NextResponse } from "next/server";

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
