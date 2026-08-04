// Read the current Fluid session — set by the auth handshake handler.
//
// Cookie shape: base64url(JSON).base64url(HMAC-SHA256(payload)). The cookie is
// set only after the JWT signature is verified — see
// app/api/auth/[...fluid]/route.ts — and authenticated again before use.

import { cookies } from "next/headers";
import { hmacSha256, timingSafeEqualBuffers } from "./crypto";

export type FluidSession = {
  user_id: number;
  user_name: string;
  company_id: number;
  company_name: string;
};

export function sealFluidSession(
  session: FluidSession,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = hmacSha256(secret, payload).toString("base64url");
  return `${payload}.${signature}`;
}

function unsealFluidSession(
  value: string,
  secret: string,
): FluidSession | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expected = hmacSha256(secret, payload);
  const provided = Buffer.from(signature, "base64url");
  if (!timingSafeEqualBuffers(provided, expected)) return null;

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    ) as FluidSession;
  } catch {
    return null;
  }
}

export async function getFluidSession(): Promise<FluidSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("mist_session")?.value;
  if (!raw) return null;

  const secret = process.env.FLUID_DROPLET_SECRET;
  if (!secret) return null;

  return unsealFluidSession(raw, secret);
}
