import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM/worker assets and resolves its data dir at runtime.
  // Keep it out of the server bundle so those paths resolve correctly.
  serverExternalPackages: ["@electric-sql/pglite"],

  // Silence the cross-origin HMR warning for local dev requests.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
