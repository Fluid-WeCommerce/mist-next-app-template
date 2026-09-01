// Proxy (Next 16's renamed middleware): allow API routes through untouched and
// set framing headers on UI routes so the droplet can only be embedded inside
// Fluid.
//
// This is defense-in-depth alongside the client-side <EmbedGuard>. It does not
// authenticate — webhook auth lives in the route (HMAC), and page auth is your
// getFluidSession() check.

import { NextRequest, NextResponse } from "next/server";

const FLUID_FRAME_ANCESTORS = "https://*.fluid.app https://fluid.app";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes (webhooks, auth callback, health) must stay reachable and
  // un-framed — let them pass through.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  // Restrict who may frame the UI to Fluid. CSP frame-ancestors is the modern
  // replacement for the (comma-broken) X-Frame-Options ALLOW-FROM.
  res.headers.set(
    "Content-Security-Policy",
    `frame-ancestors 'self' ${FLUID_FRAME_ANCESTORS}`,
  );
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
