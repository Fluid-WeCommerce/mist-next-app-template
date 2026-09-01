import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const unsupportedViewerAuthFiles = [
  "../app/api/auth/[...fluid]/route.ts",
  "../app/droplet/connect/route.ts",
  "./fluid-session.ts",
  "./jwt.ts",
];

describe("unsupported viewer authentication", () => {
  it.each(unsupportedViewerAuthFiles)("does not ship %s", (relativePath) => {
    expect(existsSync(new URL(relativePath, import.meta.url))).toBe(false);
  });
});
