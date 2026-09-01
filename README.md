# Mist Next.js Template

The starter Next.js application that Fluid Commerce uses to scaffold new
[Mist](https://fluid.app)-hosted droplets, embeds, and drop zones. This repo
is marked as a **GitHub template repository** — Mist creates each new
customer repo as a one-shot snapshot via `POST /repos/{this}/generate`.

## What's in here

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Public landing page; renders the visitor's Fluid identity if a session exists, otherwise links them to `/droplet/connect`. |
| `app/droplet/connect/route.ts` | Starts the Fluid auth handshake — visitors hit this when they want to sign in. |
| `app/api/auth/[...fluid]/route.ts` | The auth callback that **verifies Fluid's JWT signature** (HMAC-SHA256 with `FLUID_DROPLET_SECRET`) and sets the session cookie. |
| `app/api/webhooks/route.ts` | Receives webhooks from Fluid, **verifies the HMAC signature** (with replay protection), audits every event, and routes it to a handler. Lifecycle aliases also exist at `/api/webhooks/installed` and `/api/webhooks/uninstalled`. |
| `app/api/health/route.ts` | `/api/health` runs `SELECT 1` against the database — useful for monitoring. |
| `app/embed/checkout-banner/page.tsx` | Working example for the default `/embed/checkout-banner` Drop Zone declared in `droplet.config.ts`. |
| `lib/db.ts` | Environment-aware Postgres client: [PGlite](https://github.com/electric-sql/pglite) in local dev, [Neon](https://neon.tech) serverless in production. Same Drizzle interface either way. |
| `lib/schema.ts` / `lib/ensure-schema.ts` | Drizzle tables (`companies`, `webhooks`) + idempotent bootstrap DDL that runs on both PGlite and Neon. |
| `lib/webhook-verification.ts` / `lib/jwt.ts` | HMAC-SHA256 webhook signature verification (with a 5-min replay window) and HS256 JWT verification. |
| `lib/fluid/client.ts` | `FluidClient` — calls the Fluid API on an installation's behalf, constructs clients from the resolved installation DIT, and performs the v2 `exchangeInstallToken` handshake. |
| `lib/fluid/installation-reference.ts` | Reads the iframe's DRI bootstrap parameter and attaches it to same-origin API requests. |
| `lib/fluid/installation-context.ts` | Resolves one exact active installation from the DRI request header; this is the server-side tenancy boundary. |
| `lib/events/` + `lib/handlers/` | Event router and the install/uninstall lifecycle handlers. |
| `lib/config/droplet.config.ts` | Declare the webhooks, callbacks, and drop zones your droplet needs — enabled entries are auto-registered on install and cleaned up on uninstall. |
| `lib/fluid-session.ts` | `getFluidSession()` reads the session cookie set by the auth handler — call it from any page or route that needs the visitor's identity. |
| `proxy.ts` / `app/embed-guard.tsx` | Restrict framing to Fluid (CSP `frame-ancestors`) and an optional client guard for embed-only pages. |

There is no global auth gate. Every page is public by default; add a `getFluidSession()` check (and redirect to `/droplet/connect` if `null`) in the routes you want gated.

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
   authenticated per-company by HMAC signature.
4. **Uninstall** → `droplet.uninstalled` deactivates the company and removes the
   registrations that were created on install.

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

This is an interim tenancy and credential-selection contract. A holder of a
valid DRI can still invoke the Mist backend. The future OAuth/session-token
implementation must replace the resolver's unverified request input with the
signed DRI claim and replace DIT selection behind the client factory; route
business logic should not need another rewrite.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (HMAC/JWT/event-router unit tests)
```

## Local development

```bash
npm install
npm run dev
```

`npm run dev` runs the app against a local PGlite database (`./local.db`).
**No Postgres install required.** The home page renders without auth, so
you can iterate immediately. To exercise the Fluid handshake locally, set
`FLUID_BASE_URL`, `FLUID_DROPLET_UUID`, and `FLUID_DROPLET_SECRET` and
visit [`/droplet/connect`](http://localhost:3000/droplet/connect).

Open [http://localhost:3000](http://localhost:3000).

## Production deployment

Mist provisions you a Vercel project linked to your customer repo. The
project's env vars are set automatically:

| Env var | Set by Mist |
| --- | --- |
| `DATABASE_URL` | The Neon connection string for your dedicated Postgres. |
| `FLUID_DROPLET_UUID` | The droplet's UUID — used by the auth handler. |
| `FLUID_DROPLET_SECRET` | HMAC signing key for verifying Fluid-issued JWTs. Existing Mist deployments also use this as the webhook auth fallback. |
| `FLUID_WEBHOOK_AUTH_TOKEN` | Shared secret for lifecycle webhooks and legacy `AUTH_TOKEN` webhook fallback. New Mist deployments set this explicitly; older ones fall back to `FLUID_DROPLET_SECRET`. |
| `FLUID_BASE_URL` | The Fluid app's base URL. |

Push to `main` and Vercel deploys automatically. The Mist CLI (`fluid
droplet mist push`) handles the git plumbing for you.

## Updating this template

Edits here only affect **new** droplets created after the change. Existing
customer repos are independent snapshots — they don't track this template
after creation. If a customer wants to pull template improvements into an
existing droplet, they can add this repo as a git remote and cherry-pick.

## License

MIT (or whatever Fluid prefers).
