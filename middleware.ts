import { NextRequest, NextResponse } from "next/server";

// Gates every page route on a valid Fluid session cookie. The auth handler
// is exempt so the handshake can complete. In local dev (MIST_DEV=1) the
// gate is disabled so you can iterate on the app without standing up the
// full Fluid auth dance.
export function middleware(req: NextRequest) {
  if (process.env.MIST_DEV === "1") return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next();

  const session = req.cookies.get("mist_session")?.value;
  if (!session) {
    const returnTo = encodeURIComponent(req.nextUrl.toString());
    return NextResponse.redirect(
      new URL(`/api/auth/start?return_to=${returnTo}`, req.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [ "/((?!_next/static|_next/image|favicon.ico).*)" ],
};
