import { NextRequest, NextResponse } from "next/server";
import { resolveFluidInstallation, FLUID_INSTALLATION_HEADER } from "../../../lib/fluid/installation-context";
import { createFluidClientForInstallation } from "../../../lib/fluid/client";
import { verifySessionToken, sessionTokenConfig } from "../../../lib/fluid/session-token";
import { APP_SESSION_SECONDS, appSessionCookieName, createAppSession, readAppSession } from "../../../lib/fluid/embedded-session";

export const runtime = "nodejs";
const headers = { "Content-Type": "text/html; charset=utf-8", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };
// Runs before the body or any external resources. Also included on failures.
const stripToken = `<script>const u = new URL(location.href); u.searchParams.delete("session_token"); history.replaceState(history.state, "", u.pathname + u.search + u.hash);</script>`;

export async function GET(request: NextRequest) {
  try {
    sessionTokenConfig(); // missing production configuration always fails closed
    const dri = request.nextUrl.searchParams.get("dri");
    const scopedHeaders = new Headers(request.headers);
    scopedHeaders.delete(FLUID_INSTALLATION_HEADER);
    if (dri) scopedHeaders.set(FLUID_INSTALLATION_HEADER, dri);
    const context = await resolveFluidInstallation(new Request(request.url, { headers: scopedHeaders }));
    const store = await createFluidClientForInstallation(context.installation).getServingStore(context.companyId);
    const name = appSessionCookieName(context.installationId);
    const token = request.nextUrl.searchParams.get("session_token");
    const identity = token
      ? verifySessionToken(token, store)
      : readAppSession(request.cookies.get(name)?.value, context.installationId, store);
    if (!identity) throw new Error("Viewer session unavailable");
    // No token or actor is interpolated into HTML. dri stays on this app's links.
    const response = new NextResponse(`<!doctype html><html><head>${stripToken}</head><body><h1>Verified Fluid viewer</h1><p>This document has a short application session.</p><a href="?dri=${encodeURIComponent(context.installationId)}&page=next">Open another document</a></body></html>`, { headers });
    if (token) response.cookies.set(name, createAppSession(identity, context.installationId), {
      httpOnly: true, secure: true, sameSite: "none", partitioned: true,
      path: "/embed/session-example", maxAge: APP_SESSION_SECONDS,
    });
    return response;
  } catch {
    return new NextResponse(`<!doctype html><html><head>${stripToken}</head><body><p>Viewer identity unavailable. Reload this page from Fluid.</p></body></html>`, { status: 401, headers });
  }
}
