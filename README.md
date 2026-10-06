# Mist Next.js Template

The starter Next.js application that Fluid Commerce uses to scaffold new
[Mist](https://fluid.app)-hosted droplets, embeds, and drop zones. This repo
is marked as a **GitHub template repository** — Mist creates each new
customer repo as a one-shot snapshot via `POST /repos/{this}/generate`.

## What's in here

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Public landing page for a newly generated Mist application. |
| `app/api/webhooks/route.ts` | Receives webhooks from Fluid, **verifies the HMAC signature** (with replay protection), audits every event, and routes it to a handler. Lifecycle aliases also exist at `/api/webhooks/installed` and `/api/webhooks/uninstalled`. |
| `app/api/health/route.ts` | `/api/health` runs `SELECT 1` against the database — useful for monitoring. |
| `app/embed/checkout-banner/page.tsx` | Working example for the default `/embed/checkout-banner` Drop Zone declared in `droplet.config.ts`. |
| `lib/db.ts` | Environment-aware Postgres client: [PGlite](https://github.com/electric-sql/pglite) in local dev, [Neon](https://neon.tech) serverless in production. Same Drizzle interface either way. |
| `lib/schema.ts` / `lib/ensure-schema.ts` | Drizzle tables (`companies`, `webhooks`) + idempotent bootstrap DDL that runs on both PGlite and Neon. |
| `lib/webhook-verification.ts` | HMAC-SHA256 webhook signature verification with a five-minute replay window. |
| `lib/fluid/client.ts` | `FluidClient` — calls the Fluid API on an installation's behalf, constructs clients from the resolved installation DIT, and performs the v2 `exchangeInstallToken` handshake. |
| `lib/fluid/installation-reference.ts` | Reads the iframe's DRI bootstrap parameter and attaches it to same-origin API requests. |
| `lib/fluid/installation-context.ts` | Resolves one exact active installation from the DRI request header; this is the server-side tenancy boundary. |
| `lib/events/` + `lib/handlers/` | Event router and the install/uninstall lifecycle handlers. |
| `lib/config/droplet.config.ts` | Declare the webhooks, callbacks, and drop zones your droplet needs — enabled entries are auto-registered on install and cleaned up on uninstall. |
| `proxy.ts` / `app/embed-guard.tsx` | Restrict framing to Fluid (CSP `frame-ancestors`) and an optional client guard for embed-only pages. |

**Admin pages authorize by `dri` through `resolveFluidInstallation()` until Fluid supplies `session_token`. Do not invent another viewer JWT, OAuth login gate, or token that Fluid never sends.** Once `session_token` is available, verify it on the server with `verifySessionToken()` below. The DRI resolver still selects the active installation and its backend DIT; the signed token adds viewer identity. The short-lived app session cookie described below is a server-side session derived from a verified Fluid `session_token`, not a new viewer token, so it does not contradict this rule.

## Install lifecycle

This template is a full Fluid droplet, not just a landing page:

1. **One-time (droplet owner):** register the lifecycle webhook URLs on the
   Droplet so Fluid tells this app when a company installs/removes it:
   ```bash
   npm run register:webhooks   # needs FLUID_TOKEN, FLUID_DROPLET_UUID, APP_URL
   ```
   This sets `install_webhook_url` to `/api/webhooks/installed` and
   `uninstall_webhook_url` to `/api/webhooks/uninstalled` on the Droplet.
2. **A company installs the droplet** → Fluid POSTs `droplet.installed` to the
   install webhook URL. The handler exchanges the short-lived install token for
   company credentials, stores a `Company` row, and registers every enabled
   feature from `lib/config/droplet.config.ts`.
3. **Company-specific webhooks/callbacks** fire against `/api/webhooks`,
   authenticated per-installation by HMAC signature. The global lifecycle token
   is not accepted as a fallback for regular events.
4. **Uninstall** → `droplet.uninstalled` resolves the exact DRI, deactivates the
   installation, removes registrations with its DIT, and erases its retained
   DIT and webhook credential.

Webhook audit rows keep the event shape needed for diagnostics but recursively
redact DEX, DIT, webhook verification credentials, and other known access-token
fields before persistence. Handlers still receive the original in-memory
payload.

To add an event handler: write it in `lib/handlers/`, register it in
`lib/handlers/index.ts`, and enable the matching webhook in
`lib/config/droplet.config.ts`.

## Installation context for embedded requests

Fluid adds the installation UUID to the initial iframe URL as `?dri=dri_...`.
Treat that value as an installation reference: it selects the active company
installation and its backend-only DIT. It does **not** authenticate the Fluid
user viewing the iframe.

Capture the reference in browser memory and use the shared fetch wrapper for
same-origin application API calls:

```ts
import {
  fluidInstallationFetch,
  readFluidInstallationReference,
} from "@/lib/fluid/installation-reference";

const installationId = readFluidInstallationReference(window.location.href);
if (!installationId) throw new Error("Fluid installation context not found");

await fluidInstallationFetch(installationId, "/api/private-resource");
```

After capturing it, remove `dri` from the visible browser URL with
`history.replaceState` where the page architecture permits. UI responses also
send `Referrer-Policy: no-referrer` so the bootstrap URL is not disclosed as a
referrer.

Every installation-scoped route must resolve the header before reading local
data or calling Fluid:

```ts
import { createFluidClientForInstallation } from "@/lib/fluid/client";
import { resolveFluidInstallation } from "@/lib/fluid/installation-context";

const context = await resolveFluidInstallation(request);
const fluid = createFluidClientForInstallation(context.installation);
```

Never fall back to `fluid_shop`, a client-provided company id, a shared
environment token, or the only row in the database. Scope every local read and
write through `context.installation` / `context.companyId`.

A holder of a valid DRI can invoke routes using only this interim contract. When
viewer identity is required, resolve the installation first and then verify a
Fluid session token bound to its trusted store. Session tokens do not contain a
signed DRI claim and do not replace the installation's backend DIT.

## Verified viewer and later documents

`lib/fluid/session-token.ts` reads Mist's three production-only values:
`FLUID_SESSION_TOKEN_SIGNING_SECRET`, `FLUID_OAUTH_CLIENT_ID`, and
`FLUID_SESSION_TOKEN_ISSUER`. Missing configuration fails closed. The helper
checks HS256, a constant-time signature, exact issuer and audience, mandatory
integer exp/nbf with exactly 30 seconds of clock skew, the serving store's dest,
and nonblank sub. Repeated jti is allowed. The verified result is identity only;
never send a Fluid viewer JWT to a Fluid API. Use the installation DIT instead.

`/embed/session-example?dri=...&session_token=...` is a working server route.
It resolves the active installation, asks `/api/company/v1/companies/me` using
that installation's DIT for `uuid_v7`, and checks the returned numeric company
id matches the installation before using that UUID as expected dest. Refuse
missing/mismatched store identity or denied API access; never trust the token's
own dest or a browser-supplied store id as the expected store.

On first load the route verifies the URL token and issues this app's own
120-second signed HttpOnly, Secure, SameSite=None, Partitioned cookie, bound to
installation and actor/store. The cookie contains no Fluid JWT. Later full
documents use that short app session and re-resolve the active installation and
store; they need no URL token. The example strips session_token with
history.replaceState before resources load and sends no-referrer and no-store,
including on errors. Keep the dri reference on this example's own links.

The URL `session_token` is only for the first server request. Keep the iframe
`src` stable as the app navigates. Every later document works only through the
short 120-second app session cookie minted on that first request; it needs no
URL token. If that cookie is missing or expired — including because the
browser restricts embedded cookies — the page must ask the viewer to reload the
page from Fluid, since a fresh Fluid mount carries a new `session_token`. Never
bypass verification, and never reuse a URL token, a `localStorage` token, or a
parent admin JWT in its place. This example deliberately returns 401 until that
reload happens; adapt its verified token exchange to your app's routes and CSRF
policy.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (installation, HMAC, lifecycle, and router tests)
```

## Local development

```bash
npm install
npm run dev
```

`npm run dev` runs the app against a local PGlite database (`./local.db`).
**No Postgres install required.** The home page renders without viewer auth,
so you can iterate immediately. Configure the lifecycle webhook variables only
when exercising install/uninstall delivery locally.

Open [http://localhost:3000](http://localhost:3000).

## Production deployment

Mist provisions you a Vercel project linked to your customer repo. The
project's env vars are set automatically:

| Env var | Set by Mist |
| --- | --- |
| `DATABASE_URL` | The Neon connection string for your dedicated Postgres. |
| `FLUID_DROPLET_UUID` | The droplet's UUID, used for lifecycle registration and platform identity. |
| `FLUID_DROPLET_SECRET` | Compatibility fallback for lifecycle webhook authentication on existing Mist deployments. It is not viewer authentication and is not accepted for regular company events. |
| `FLUID_WEBHOOK_AUTH_TOKEN` | Bootstrap secret for install/uninstall lifecycle webhooks. It is not accepted for regular company events. New Mist deployments set this explicitly; older lifecycle registrations fall back to `FLUID_DROPLET_SECRET`. |
| `FLUID_BASE_URL` | The Fluid app's base URL. |
| `FLUID_SESSION_TOKEN_SIGNING_SECRET` | Linked droplet's session-token verification key (server only, production only). |
| `FLUID_OAUTH_CLIENT_ID` | Expected session-token audience (production only). |
| `FLUID_SESSION_TOKEN_ISSUER` | Expected session-token issuer (production only). |

Push to `main` and Vercel deploys automatically. The Mist CLI (`fluid
droplet mist push`) handles the git plumbing for you.

## Updating this template

Edits here only affect **new** droplets created after the change. Existing
customer repos are independent snapshots — they don't track this template
after creation. If a customer wants to pull template improvements into an
existing droplet, they can add this repo as a git remote and cherry-pick.

## License

MIT (or whatever Fluid prefers).
