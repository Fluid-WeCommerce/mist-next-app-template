// Webhook ingestion endpoint.
//
// Receives webhooks from Fluid, authenticates them (HMAC-SHA256 signature with
// replay protection, or a legacy shared-secret fallback), records every event
// in the audit log, and routes it to the registered handler.
//
// Fluid sends:
//   X-Fluid-Signature  HMAC-SHA256 of "{timestamp}.{rawBody}"
//   X-Fluid-Timestamp  unix seconds
//   X-Fluid-Shop       fluid_shop of the sending company
//   AUTH_TOKEN         legacy shared secret (fallback)

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { webhooks } from "@/lib/schema";
import { routeEvent } from "@/lib/events";
import { initializeHandlers } from "@/lib/handlers";
import {
  verifyWebhookSignature,
  getWebhookHeaders,
  tokensMatch,
} from "@/lib/webhook-verification";
import { findActiveCompanyByShop } from "@/lib/repositories/companies";
import {
  getWebhookAuthToken,
  WEBHOOK_AUTH_TOKEN_ENV_DESCRIPTION,
} from "@/lib/webhook-auth-token";

// node:crypto + Neon/PGlite need the Node runtime, not the edge runtime.
export const runtime = "nodejs";

// Register event handlers once on module load.
initializeHandlers();

interface AuthResult {
  authenticated: boolean;
  companyId?: string;
  error?: string;
  // Response status to use when not authenticated (defaults to 401). 500 marks
  // a server misconfiguration rather than a rejected caller.
  status?: number;
}

type WebhookHeaders = ReturnType<typeof getWebhookHeaders>;

// Lifecycle events (droplet.installed/uninstalled) are verified against the
// global webhook secret — there's no per-company token until install completes.
function authenticateLifecycle(headers: WebhookHeaders, rawBody: string): AuthResult {
  const secret = getWebhookAuthToken();
  if (!secret) {
    return {
      authenticated: false,
      error: `${WEBHOOK_AUTH_TOKEN_ENV_DESCRIPTION} not configured`,
      status: 500,
    };
  }
  const result = verifyWebhookSignature(rawBody, headers.signature, headers.timestamp, secret);
  if (result.valid) return { authenticated: true };
  // Allow legacy shared-secret auth for lifecycle events without a signature.
  if (authenticateWithSharedSecret(headers.authToken).authenticated) {
    return { authenticated: true };
  }
  return { authenticated: false, error: result.error };
}

// Regular webhooks prefer per-company HMAC (keyed by the company's
// webhook_verification_token, looked up via X-Fluid-Shop) and fall back to the
// global shared-secret AUTH_TOKEN.
async function authenticateWebhook(headers: WebhookHeaders, rawBody: string): Promise<AuthResult> {
  if (headers.signature && headers.timestamp) {
    if (!headers.fluidShop) {
      return { authenticated: false, error: "Missing X-Fluid-Shop header for signature verification" };
    }

    const company = await findActiveCompanyByShop(headers.fluidShop);
    if (!company) {
      return { authenticated: false, error: `No active company for fluid_shop: ${headers.fluidShop}` };
    }

    if (!company.webhookVerificationToken) {
      // Install may predate per-company tokens — fall back to the global token
      // but keep companyId so the audit row is still linked.
      return {
        ...authenticateWithSharedSecret(headers.authToken),
        companyId: company.id,
      };
    }

    const result = verifyWebhookSignature(
      rawBody,
      headers.signature,
      headers.timestamp,
      company.webhookVerificationToken,
    );
    return result.valid
      ? { authenticated: true, companyId: company.id }
      : { authenticated: false, error: result.error, companyId: company.id };
  }

  return authenticateWithSharedSecret(headers.authToken);
}

function authenticateWithSharedSecret(authToken: string | null): AuthResult {
  const expected = getWebhookAuthToken();
  if (!expected) {
    return {
      authenticated: false,
      error: `${WEBHOOK_AUTH_TOKEN_ENV_DESCRIPTION} not configured`,
    };
  }
  if (authToken && tokensMatch(authToken, expected)) {
    return { authenticated: true };
  }
  return { authenticated: false, error: "Invalid auth token" };
}

export async function POST(request: NextRequest) {
  await ensureSchema();

  // Read the raw body for signature verification, then parse.
  const rawBody = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resource, event, version } = parseEvent(body);
  if (!resource || !event) {
    return NextResponse.json(
      { error: "Missing resource or event in webhook payload" },
      { status: 400 },
    );
  }
  const eventType = `${resource}.${event}`;
  console.log(`[webhook] received ${eventType}`);

  // Handlers expect the inner payload (with `company`), not the envelope.
  const payloadForHandler = body.payload ?? body;

  // Authenticate: lifecycle events use the global secret, everything else uses
  // per-company HMAC (falling back to the shared secret).
  const isLifecycle =
    resource === "droplet" && (event === "installed" || event === "uninstalled");
  const headers = getWebhookHeaders(request.headers);
  const auth = isLifecycle
    ? authenticateLifecycle(headers, rawBody)
    : await authenticateWebhook(headers, rawBody);

  if (!auth.authenticated) {
    if (auth.status === 500) {
      console.error(`[webhook] ${WEBHOOK_AUTH_TOKEN_ENV_DESCRIPTION} not configured`);
      return NextResponse.json({ error: "Webhook authentication not configured" }, { status: 500 });
    }
    console.warn(`[webhook] unauthorized ${eventType}: ${auth.error}`);
    return NextResponse.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
  }
  const authenticatedCompanyId = auth.companyId;

  // Audit: record the webhook before processing.
  const conn = await db();
  const webhookId = randomUUID();
  await conn.insert(webhooks).values({
    id: webhookId,
    resource,
    event,
    eventType,
    version: version ?? null,
    payload: body as unknown,
    processed: false,
    companyId: authenticatedCompanyId ?? null,
  });

  // Route to the handler, recording success/failure on the audit row.
  try {
    const handled = await routeEvent(eventType, payloadForHandler, version);
    await conn.update(webhooks).set({ processed: handled }).where(eq(webhooks.id, webhookId));

    if (!handled) {
      console.log(`[webhook] no handler for ${eventType}`);
      // 202: accepted for audit, but nothing processed it.
      return NextResponse.json({ received: true, handled: false }, { status: 202 });
    }
    return NextResponse.json({ received: true, handled: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] handler for ${eventType} threw:`, message);
    await conn
      .update(webhooks)
      .set({ processed: false, error: message })
      .where(eq(webhooks.id, webhookId));
    return NextResponse.json({ error: "Handler failed", message }, { status: 500 });
  }
}

// Derives resource/event/version from a Fluid webhook body. Fluid sends a
// `name` like "droplet_installed" or "order_created"; older payloads use
// separate resource/event fields (top level or nested under payload).
function parseEvent(body: Record<string, unknown>): {
  resource?: string;
  event?: string;
  version?: string;
} {
  let resource: string | undefined;
  let event: string | undefined;

  const name = typeof body.name === "string" ? body.name : undefined;
  if (name) {
    const idx = name.indexOf("_");
    if (idx > 0) {
      resource = name.substring(0, idx);
      event = name.substring(idx + 1);
    }
  }

  const payload = body.payload as Record<string, unknown> | undefined;
  if (!resource || !event) {
    resource = (body.resource as string) || (payload?.resource as string);
    event = (body.event as string) || (payload?.event as string);
  }

  const version =
    (body.version as string) ||
    (body.schema_version as string) ||
    (payload?.version as string) ||
    (payload?.schema_version as string) ||
    undefined;

  return { resource, event, version };
}
