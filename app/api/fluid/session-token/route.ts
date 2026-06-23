import { fluid } from "@/lib/fluid";
import { getFluidSession } from "@/lib/fluid-session";
import type { AppBridgeSessionTokenRequest } from "@fluid-commerce/sdk/next";
import { NextRequest } from "next/server";

type SessionTokenRequestBody = Omit<AppBridgeSessionTokenRequest, "clientId">;

export async function POST(req: NextRequest) {
  const session = await getFluidSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = process.env.FLUID_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      {
        error: "configuration_error",
        message: "FLUID_CLIENT_ID must be configured",
      },
      { status: 500 },
    );
  }

  try {
    const body = await req.json() as SessionTokenRequestBody;
    const token = await fluid().session.mintAppBridgeSessionToken({
      ...body,
      clientId,
    });
    return Response.json({ token });
  } catch (err: unknown) {
    return Response.json(
      {
        error: "session_token_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
