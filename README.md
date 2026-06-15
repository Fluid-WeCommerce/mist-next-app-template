# Mist Next.js Template

The starter Next.js application that Fluid Commerce uses to scaffold new
[Mist](https://fluid.app)-hosted droplets, embeds, and drop zones. This repo
is marked as a **GitHub template repository** — Mist creates each new
customer repo as a one-shot snapshot via `POST /repos/{this}/generate`.

## What's in here

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Landing page; renders the visitor's Fluid identity in production. |
| `app/api/auth/[...fluid]/route.ts` | The two-step Fluid auth handshake (`/start` and `/callback`). |
| `app/api/health/route.ts` | `/api/health` runs `SELECT 1` against the database — useful for monitoring. |
| `lib/db.ts` | Environment-aware Postgres client: [PGlite](https://github.com/electric-sql/pglite) in local dev, [Neon](https://neon.tech) serverless in production. Same Drizzle interface either way. |
| `lib/fluid-session.ts` | `getFluidSession()` reads the session cookie set by the auth handler. |
| `middleware.ts` | Gates page routes on a valid session in production; bypassed in local dev. |

## Local development

```bash
npm install
npm run dev
```

`npm run dev` sets `MIST_DEV=1` and runs the app against a local PGlite
database (`./local.db`). **No Postgres install required.** Auth is bypassed
in dev so you can iterate without the full Fluid handshake.

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
