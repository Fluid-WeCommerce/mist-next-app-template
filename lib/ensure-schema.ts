// Bootstrap the droplet's tables on first use.
//
// Mist droplets don't wire up a migration step, so call ensureSchema() once
// before your first query (it runs automatically inside the webhook route and
// the DB-backed helpers). It runs idempotent `CREATE TABLE IF NOT EXISTS`
// statements against whichever backend lib/db.ts resolves to — PGlite locally,
// Neon in prod — so the SQL is identical across environments.
//
// The `companies` and `webhooks` tables back the install lifecycle and the
// webhook audit log (see lib/schema.ts). Add your own tables below. For
// anything larger, graduate to real migrations (e.g. drizzle-kit) instead of
// growing this file.

import { sql } from "drizzle-orm";
import { db } from "./db";

let _ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  // Run once per process; subsequent callers await the same promise.
  if (_ready) return _ready;

  _ready = (async () => {
    const conn = await db();

    // One row per company that has installed this droplet.
    await conn.execute(sql`
      CREATE TABLE IF NOT EXISTS companies (
        id                          TEXT PRIMARY KEY,
        fluid_company_id            INTEGER,
        fluid_shop                  TEXT,
        name                        TEXT,
        company_droplet_uuid        TEXT,
        droplet_installation_uuid   TEXT,
        authentication_token        TEXT,
        webhook_verification_token  TEXT,
        registered_ids              JSONB,
        active                      BOOLEAN NOT NULL DEFAULT true,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // droplet_installation_uuid is the tenant key — unique per installation.
    // company_droplet_uuid is intentionally NOT unique (shared across installs).
    await conn.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS companies_installation_uuid_idx
      ON companies (droplet_installation_uuid)
    `);

    // Append-only audit log of every webhook received.
    await conn.execute(sql`
      CREATE TABLE IF NOT EXISTS webhooks (
        id          TEXT PRIMARY KEY,
        resource    TEXT NOT NULL,
        event       TEXT NOT NULL,
        event_type  TEXT NOT NULL,
        version     TEXT,
        payload     JSONB,
        processed   BOOLEAN NOT NULL DEFAULT false,
        error       TEXT,
        company_id  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  })().catch((err) => {
    // Don't cache a failed bootstrap — let the next call retry.
    _ready = null;
    throw err;
  });

  return _ready;
}
