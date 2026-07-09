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
| `app/api/webhooks/route.ts` | Receives webhooks from Fluid, **verifies the HMAC signature** (with replay protection), audits every event, and routes it to a handler. |
| `app/api/health/route.ts` | `/api/health` runs `SELECT 1` against the database — useful for monitoring. |
| `lib/db.ts` | Environment-aware Postgres client: [PGlite](https://github.com/electric-sql/pglite) in local dev, [Neon](https://neon.tech) serverless in production. Same Drizzle interface either way. |
| `lib/schema.ts` / `lib/ensure-schema.ts` | Drizzle tables (`companies`, `webhooks`) + idempotent bootstrap DDL that runs on both PGlite and Neon. |
| `lib/webhook-verification.ts` / `lib/jwt.ts` | HMAC-SHA256 webhook signature verification (with a 5-min replay window) and HS256 JWT verification. |
| `lib/fluid/client.ts` | `FluidClient` — calls the Fluid API on a company's behalf (create/delete webhooks, callbacks, drop zones) plus the v2 `exchangeInstallToken` handshake. |
| `lib/events/` + `lib/handlers/` | Event router and the install/uninstall lifecycle handlers. |
| `lib/config/droplet.config.ts` | Declare the webhooks, callbacks, and drop zones your droplet needs — enabled entries are auto-registered on install and cleaned up on uninstall. |
| `lib/fluid-session.ts` | `getFluidSession()` reads the session cookie set by the auth handler — call it from any page or route that needs the visitor's identity. |
| `proxy.ts` / `app/embed-guard.tsx` | Restrict framing to Fluid (CSP `frame-ancestors`) and an optional client guard for embed-only pages. |

There is no global auth gate. Every page is public by default; add a `getFluidSession()` check (and redirect to `/droplet/connect` if `null`) in the routes you want gated.

## Install lifecycle

This template is a full Fluid droplet, not just a landing page:

1. **One-time (droplet owner):** register the lifecycle webhooks so Fluid tells
   this droplet when a company installs/removes it:
   ```bash
   npm run register:webhooks   # needs FLUID_TOKEN, APP_URL, FLUID_WEBHOOK_AUTH_TOKEN
   ```
2. **A company installs the droplet** → Fluid POSTs `droplet.installed` to
   `/api/webhooks`. The handler stores a `Company` row (with its auth tokens)
   and registers every enabled feature from `lib/config/droplet.config.ts`.
3. **Company-specific webhooks/callbacks** fire against `/api/webhooks`,
   authenticated per-company by HMAC signature.
4. **Uninstall** → `droplet.uninstalled` deactivates the company and removes the
   registrations that were created on install.

To add an event handler: write it in `lib/handlers/`, register it in
`lib/handlers/index.ts`, and enable the matching webhook in
`lib/config/droplet.config.ts`.

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
| `FLUID_DROPLET_SECRET` | HMAC signing key for verifying Fluid-issued JWTs (Phase 002). |
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
