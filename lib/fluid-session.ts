// Read the current Fluid session — set by the auth handshake handler.
//
// Cookie shape: base64-encoded JSON {user_id, user_name, company_id, company_name}.
// See app/api/auth/[...fluid]/route.ts and middleware.ts.

import { cookies } from "next/headers";

export type FluidSession = {
  user_id: number;
  user_name: string;
  company_id: number;
  company_name: string;
};

export async function getFluidSession(): Promise<FluidSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("mist_session")?.value;
  if (!raw) return null;

  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as FluidSession;
  } catch {
    return null;
  }
}
