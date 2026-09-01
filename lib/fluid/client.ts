// Fluid API client.
//
// Thin fetch wrapper for calling the Fluid API on a company's behalf — used to
// register/clean up webhooks, callbacks, and drop zones during the install
// lifecycle. Construct it with a company's authentication_token.

import { getFluidApiUrl } from "../app-url";
import type { Company } from "../schema";

export interface CreateWebhookPayload {
  resource: string;
  url: string;
  active?: boolean;
  auth_token: string;
  event: string;
  http_method?: "post" | "get" | "put" | "delete";
}

export interface CreateCallbackPayload {
  // Must match a callback definition (YAML) registered in Fluid.
  definition_name: string;
  url: string;
  active?: boolean;
}

export interface CreateDropZonePayload {
  name: string;
  uuid: string;
  active?: boolean;
  settings: {
    page: string;
    zone: string;
    priority?: number;
  };
  embed_url: string;
}

export interface WebhookResponse {
  webhook: { id: number | string; [k: string]: unknown };
}

export interface CallbackResponse {
  callback_registration: { uuid: string; [k: string]: unknown };
}

export interface DropZoneResponse {
  drop_zone: { uuid?: string; id?: number; [k: string]: unknown };
}

export class FluidApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`Fluid API error: ${status} on ${path} - ${body}`);
    this.name = "FluidApiError";
  }
}

export class FluidClient {
  private baseUrl: string;
  private authToken: string;

  constructor(authToken: string, baseUrl?: string) {
    this.authToken = authToken;
    this.baseUrl = baseUrl || getFluidApiUrl();
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new FluidApiError(response.status, path, errorBody);
    }

    return response.json() as Promise<T>;
  }

  // --- Webhooks ---

  createWebhook(payload: CreateWebhookPayload): Promise<WebhookResponse> {
    return this.request("/api/company/webhooks", {
      method: "POST",
      body: JSON.stringify({ webhook: { active: true, http_method: "post", ...payload } }),
    });
  }

  deleteWebhook(webhookId: string): Promise<void> {
    return this.request(`/api/company/webhooks/${webhookId}`, { method: "DELETE" });
  }

  listWebhooks<T = unknown>(): Promise<T> {
    return this.request("/api/company/webhooks", { method: "GET" });
  }

  // --- Callbacks ---

  createCallback(payload: CreateCallbackPayload): Promise<CallbackResponse> {
    return this.request("/api/callback/registrations", {
      method: "POST",
      body: JSON.stringify({ callback_registration: { active: true, ...payload } }),
    });
  }

  deleteCallback(callbackUuid: string): Promise<void> {
    return this.request(`/api/callback/registrations/${callbackUuid}`, { method: "DELETE" });
  }

  // --- Drop zones ---

  createDropZone(payload: CreateDropZonePayload): Promise<DropZoneResponse> {
    return this.request("/api/drop_zones", {
      method: "POST",
      body: JSON.stringify({ drop_zone: { active: true, ...payload } }),
    });
  }

  deleteDropZone(dropZoneUuid: string): Promise<void> {
    return this.request(`/api/drop_zones/${dropZoneUuid}`, { method: "DELETE" });
  }
}

export function createFluidClient(authToken: string): FluidClient {
  return new FluidClient(authToken);
}

export function createFluidClientForInstallation(
  installation: Company,
): FluidClient {
  if (!installation.active || !installation.authenticationToken) {
    throw new Error("Fluid installation credential is unavailable");
  }

  return createFluidClient(installation.authenticationToken);
}

// --- Exchange Token Flow (v2 install handshake) ---

export interface ExchangeTokenResponse {
  droplet_installation: {
    droplet_installation_uuid: string;
    droplet_uuid: string;
    fluid_company_id: number;
    fluid_shop: string;
  };
  credentials: {
    authentication_token: string;
    webhook_verification_token: string;
    issued_at: string;
    token_type: string;
  };
}

// Exchanges a short-lived install token for long-lived credentials (v2).
// Standalone because at exchange time there is no auth token yet — the
// exchange token itself is the credential.
export async function exchangeInstallToken(
  exchangeToken: string,
  exchangeEndpoint?: string,
): Promise<ExchangeTokenResponse> {
  const baseUrl = getFluidApiUrl();
  const path = exchangeEndpoint || "/api/droplet_installations/exchange";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exchange_token: exchangeToken }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }
    return response.json() as Promise<ExchangeTokenResponse>;
  } finally {
    clearTimeout(timeout);
  }
}
