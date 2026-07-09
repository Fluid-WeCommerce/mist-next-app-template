#!/usr/bin/env node
// One-time setup (droplet owner): register the droplet.installed and
// droplet.uninstalled lifecycle webhooks on YOUR Fluid company so Fluid
// notifies this droplet when a company installs or removes it.
//
// Usage (from the repo root):
//   FLUID_TOKEN=... APP_URL=https://your-droplet.vercel.app \
//   FLUID_WEBHOOK_AUTH_TOKEN=... node scripts/register-lifecycle-webhooks.mjs
//
// Reads .env.local if present. Idempotency is Fluid-side — re-running may
// create duplicates, so run it once (or delete stale webhooks first).

import { readFileSync } from "node:fs";

function loadDotEnv(path) {
  try {
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — rely on the shell environment */
  }
}

loadDotEnv(".env.local");

const apiUrl = process.env.FLUID_API_URL || "https://api.fluid.app";
const token = process.env.FLUID_TOKEN;
const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
const authToken = process.env.FLUID_WEBHOOK_AUTH_TOKEN;

if (!token || !appUrl || !authToken) {
  console.error(
    "Missing required env. Need FLUID_TOKEN, APP_URL, and FLUID_WEBHOOK_AUTH_TOKEN.",
  );
  process.exit(1);
}

const webhookUrl = `${appUrl}/api/webhooks`;

async function register(event) {
  const res = await fetch(`${apiUrl}/api/company/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      webhook: {
        resource: "droplet",
        event,
        url: webhookUrl,
        active: true,
        auth_token: authToken,
        http_method: "post",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`register ${event} failed: ${res.status} ${await res.text()}`);
  }
  console.log(`✓ registered droplet.${event} → ${webhookUrl}`);
}

try {
  await register("installed");
  await register("uninstalled");
  console.log("Done.");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
