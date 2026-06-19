// Bootstrap your tables on first use.
//
// Mist droplets don't wire up a migration step, so call ensureSchema() once
// before your first query (e.g. at the top of a route handler or server
// action). It runs idempotent `CREATE TABLE IF NOT EXISTS` statements against
// whichever backend lib/db.ts resolves to — PGlite locally, Neon in prod —
// so the SQL is identical across environments.
//
// This is a stub: replace the example statement with your own tables. For
// anything beyond a handful of tables, graduate to real migrations
// (e.g. drizzle-kit) instead of growing this file.

import { sql } from "drizzle-orm";
import { db } from "./db";

let _ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  // Run once per process; subsequent callers await the same promise.
  if (_ready) return _ready;

  _ready = (async () => {
    const conn = await db();

    await conn.execute(sql`
      CREATE TABLE IF NOT EXISTS greetings (
        id         SERIAL PRIMARY KEY,
        message    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  })().catch((err) => {
    // Don't cache a failed bootstrap — let the next call retry.
    _ready = null;
    throw err;
  });

  return _ready;
}
