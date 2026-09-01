const CREDENTIAL_KEYS = new Set([
  "access_token",
  "authentication_token",
  "client_secret",
  "exchange_token",
  "refresh_token",
  "webhook_verification_token",
]);

export function redactWebhookPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map(redactWebhookPayload);
  }

  if (!isRecord(payload)) return payload;

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      CREDENTIAL_KEYS.has(key) ? "[REDACTED]" : redactWebhookPayload(value),
    ]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
