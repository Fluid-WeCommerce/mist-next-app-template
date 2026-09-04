import { describe, expect, it } from "vitest";
import { redactWebhookPayload } from "./webhook-audit";

describe("redactWebhookPayload", () => {
  it("redacts lifecycle credentials without mutating the handler payload", () => {
    const payload = {
      name: "droplet_installed",
      payload: {
        company: {
          name: "Example Company",
          authentication_token: "dit_secret",
          webhook_verification_token: "wvt_secret",
          credentials: {
            exchange_token: "dex_secret",
            exchange_endpoint: "/api/droplet_installations/exchange",
          },
        },
      },
    };

    const auditPayload = redactWebhookPayload(payload);

    expect(auditPayload).toEqual({
      name: "droplet_installed",
      payload: {
        company: {
          name: "Example Company",
          authentication_token: "[REDACTED]",
          webhook_verification_token: "[REDACTED]",
          credentials: {
            exchange_token: "[REDACTED]",
            exchange_endpoint: "/api/droplet_installations/exchange",
          },
        },
      },
    });
    expect(payload.payload.company.authentication_token).toBe("dit_secret");
    expect(payload.payload.company.credentials.exchange_token).toBe("dex_secret");
  });

  it("redacts credentials nested inside arrays", () => {
    const payload = {
      deliveries: [
        {
          credentials: [
            { authentication_token: "dit_secret" },
            { exchange_token: "dex_secret" },
          ],
        },
      ],
    };

    expect(redactWebhookPayload(payload)).toEqual({
      deliveries: [
        {
          credentials: [
            { authentication_token: "[REDACTED]" },
            { exchange_token: "[REDACTED]" },
          ],
        },
      ],
    });
  });
});
