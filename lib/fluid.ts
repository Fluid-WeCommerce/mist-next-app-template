import {
  createNextFluidServerClient,
  type FluidOAuthRefreshTokenStore,
} from "@fluid-commerce/sdk/next";
import { sql } from "drizzle-orm";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { ensureSchema } from "./ensure-schema";

const DEFAULT_CREDENTIAL_KEY = "default";

let _fluid: ReturnType<typeof createNextFluidServerClient> | null = null;

export function fluid() {
  if (_fluid) return _fluid;

  const baseUrl = process.env.FLUID_BASE_URL || "https://fluid.app";
  const clientId = process.env.FLUID_CLIENT_ID;
  const clientSecret = process.env.FLUID_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("FLUID_CLIENT_ID and FLUID_CLIENT_SECRET must be configured");
  }

  _fluid = createNextFluidServerClient({
    baseUrl,
    credentials: { clientId, clientSecret },
    refreshTokens: createDatabaseRefreshTokenStore(),
    defaultCredentialKey: DEFAULT_CREDENTIAL_KEY,
  });

  return _fluid;
}

function createDatabaseRefreshTokenStore(): FluidOAuthRefreshTokenStore {
  return {
    async getRefreshToken(key) {
      await ensureSchema();
      const conn = await db();
      const result = await conn.execute(sql`
        SELECT refresh_token_ciphertext
        FROM fluid_oauth_refresh_tokens
        WHERE credential_key = ${key}
        LIMIT 1
      `);
      const row = firstRow(result);
      const ciphertext = row?.refresh_token_ciphertext;
      return typeof ciphertext === "string" ? decrypt(ciphertext) : null;
    },
    async setRefreshToken(key, refreshToken) {
      await ensureSchema();
      const conn = await db();
      await conn.execute(sql`
        INSERT INTO fluid_oauth_refresh_tokens (credential_key, refresh_token_ciphertext, updated_at)
        VALUES (${key}, ${encrypt(refreshToken)}, now())
        ON CONFLICT (credential_key)
        DO UPDATE SET refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
                      updated_at = now()
      `);
    },
    async deleteRefreshToken(key) {
      await ensureSchema();
      const conn = await db();
      await conn.execute(sql`
        DELETE FROM fluid_oauth_refresh_tokens
        WHERE credential_key = ${key}
      `);
    },
  };
}

function firstRow(result: unknown): Record<string, unknown> | null {
  if (Array.isArray(result)) return toRecord(result[0]);
  if (typeof result === "object" && result !== null && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? toRecord(rows[0]) : null;
  }
  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function encryptionKey(): Buffer {
  const secret = process.env.FLUID_SDK_ENCRYPTION_KEY;
  if (!secret) throw new Error("FLUID_SDK_ENCRYPTION_KEY must be configured");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted Fluid refresh token");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
