import path from "node:path";

/**
 * Load local credentials before any test imports `lib/env.ts`.
 *
 * Next.js loads `.env.local` itself at runtime; under Vitest nothing does, so the
 * lazy env accessors would throw on first use. `process.loadEnvFile` is built
 * into Node >= 20.6, so this needs no dotenv dependency.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Absent is fine: CI injects variables directly.
  }
}
