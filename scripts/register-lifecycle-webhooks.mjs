#!/usr/bin/env node
// One-time setup (droplet owner): point the Droplet install/uninstall
// lifecycle webhook URLs at this Mist app. Fluid calls these URLs when a
// company installs or removes the Droplet, and the install handler exchanges
// the short-lived install token for company credentials.
//
// Usage (from the repo root):
//   FLUID_TOKEN=... FLUID_DROPLET_UUID=drp_... APP_URL=https://your-app \
//     node scripts/register-lifecycle-webhooks.mjs
//
// Reads .env.local if present. Re-running is safe: this updates the Droplet's
// lifecycle URLs to the current APP_URL.

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
const dropletUuid = process.env.FLUID_DROPLET_UUID;
const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");

if (!token || !dropletUuid || !appUrl) {
  console.error("Missing required env. Need FLUID_TOKEN, FLUID_DROPLET_UUID, and APP_URL.");
  process.exit(1);
}

const installWebhookUrl = `${appUrl}/api/webhooks/installed`;
const uninstallWebhookUrl = `${appUrl}/api/webhooks/uninstalled`;

try {
  const res = await fetch(`${apiUrl}/api/droplets/${encodeURIComponent(dropletUuid)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      droplet: {
        install_webhook_url: installWebhookUrl,
        uninstall_webhook_url: uninstallWebhookUrl,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`register lifecycle webhooks failed: ${res.status} ${await res.text()}`);
  }

  console.log(`✓ install webhook → ${installWebhookUrl}`);
  console.log(`✓ uninstall webhook → ${uninstallWebhookUrl}`);
  console.log("Done.");
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
