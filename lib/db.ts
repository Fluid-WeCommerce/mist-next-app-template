// Environment-aware Postgres client for Mist-hosted droplets.
//
// In local dev (when MIST_DEV=1, set by `npm run dev`) this uses PGlite —
// an in-process Postgres compiled to WASM, persisted to ./local.db (gitignored).
// No install required and the SQL dialect is identical to production.
//
// In production / preview deploys (running on Vercel) it uses
// @neondatabase/serverless with DATABASE_URL — set on the Vercel project
// at create time by Mist.
//
// Both paths return the same Drizzle interface so query code is identical.

import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";

type DbClient =
  | ReturnType<typeof drizzlePglite>
  | ReturnType<typeof drizzleNeon>;

let _db: DbClient | null = null;

export async function db(): Promise<DbClient> {
  if (_db) return _db;

  if (process.env.MIST_DEV === "1") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { pathToFileURL } = await import("node:url");
    const path = await import("node:path");
    // Pass a proper file:// URL string, not a bare relative path. PGlite
    // resolves a relative path through import.meta.url, which Next 16's server
    // runtime hands to node:fs as a URL object → ERR_INVALID_ARG_TYPE.
    // (Use { dataDir: "memory://" } instead if you don't need persistence.)
    const client = new PGlite({
      dataDir: pathToFileURL(path.join(process.cwd(), "local.db")).href,
    });
    _db = drizzlePglite(client) as DbClient;
  } else {
    const { neon } = await import("@neondatabase/serverless");
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const client = neon(url);
    _db = drizzleNeon(client) as DbClient;
  }

  return _db;
}
