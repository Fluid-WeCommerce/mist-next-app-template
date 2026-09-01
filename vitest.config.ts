import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // PGlite and Next server bundles intentionally share one process-level
    // connection cache. Running database-backed files concurrently with the
    // cache-reset test can initialize the same data directory twice.
    fileParallelism: false,
  },
});
