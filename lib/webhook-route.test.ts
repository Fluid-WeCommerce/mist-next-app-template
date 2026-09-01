import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/webhooks/route";
import { hmacSha256 } from "./crypto";
import { db } from "./db";
import { upsertCompany } from "./repositories/companies";
import { webhooks } from "./schema";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("webhook route", () => {
  it("stores a redacted audit payload for an installation-signed webhook", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fluidShop = `shop-${randomUUID()}`;
    const webhookVerificationToken = `wvt_${randomUUID()}`;
    const installation = await upsertCompany({
      fluidCompanyId: 1_515,
      fluidShop,
      companyDropletUuid: "drp_template",
      dropletInstallationUuid: `dri_${randomUUID().replaceAll("-", "")}`,
      authenticationToken: `dit_${randomUUID()}`,
      webhookVerificationToken,
    });
    const resource = `audit${randomUUID().replaceAll("-", "")}`;
    const event = "received";
    const body = JSON.stringify({
      resource,
      event,
      payload: {
        credentials: { exchange_token: "dex_secret" },
        authentication_token: "dit_secret",
        webhook_verification_token: "wvt_secret",
        safe: "kept",
      },
    });
    const timestamp = Math.floor(Date.now() / 1_000).toString();
    const signature = hmacSha256(
      webhookVerificationToken,
      `${timestamp}.${body}`,
    ).toString("hex");
    const request = new NextRequest("https://droplet.example/api/webhooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fluid-Shop": fluidShop,
        "X-Fluid-Signature": signature,
        "X-Fluid-Timestamp": timestamp,
      },
      body,
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    const connection = await db();
    const [audit] = await connection
      .select()
      .from(webhooks)
      .where(eq(webhooks.eventType, `${resource}.${event}`))
      .limit(1);
    expect(audit.companyId).toBe(installation.id);
    expect(audit.payload).toMatchObject({
      payload: {
        credentials: { exchange_token: "[REDACTED]" },
        authentication_token: "[REDACTED]",
        webhook_verification_token: "[REDACTED]",
        safe: "kept",
      },
    });
  });

  it("rejects the global lifecycle token for a regular company webhook", async () => {
    vi.stubEnv("MIST_DEV", "1");
    vi.stubEnv("FLUID_WEBHOOK_AUTH_TOKEN", "lifecycle-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const body = JSON.stringify({
      resource: `resource-${randomUUID()}`,
      event: "created",
      payload: { id: "event-123" },
    });
    const request = new NextRequest("https://droplet.example/api/webhooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Auth-Token": "lifecycle-secret",
      },
      body,
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
