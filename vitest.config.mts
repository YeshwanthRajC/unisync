import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest configuration.
 *
 * Two non-obvious settings:
 *
 *  - `server-only` is aliased to a no-op. That package throws on import unless
 *    the resolver selects its "react-server" condition, which Node only applies
 *    via a CLI flag and which never reaches externalised CJS dependencies. The
 *    guard's job is to fail a Client Component that imports server code at build
 *    time; a Node test runner is not that, so stubbing it is correct rather than
 *    a workaround.
 *
 *  - `fileParallelism: false` in a single fork. The suites share one real
 *    Postgres database and tenant-isolation tests assert on row counts, so
 *    parallel files would see each other's fixtures.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: path.resolve(root, "tests/stubs/server-only.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(root, "$1") },
    ],
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    pool: "forks",
    fileParallelism: false,
    isolate: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
