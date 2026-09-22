import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 no longer loads dotenv files implicitly, so Next.js's `.env.local`
 * is loaded here explicitly. This keeps ONE local secret file for both the
 * application and the Prisma CLI, instead of duplicating credentials into a
 * separate `.env`.
 *
 * `process.loadEnvFile` is built into Node >= 20.6 — no dotenv dependency.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Absent is fine: on Vercel / CI the variables are injected directly.
  }
}

/**
 * Connection URL used by the Prisma CLI (migrate, db push, studio) ONLY.
 *
 * Supabase pools connections through Supavisor on port 6543, which cannot run
 * DDL or hold advisory locks reliably, so schema migrations must use the
 * DIRECT connection on port 5432. Application queries take the pooled
 * DATABASE_URL via the driver adapter in `lib/db/prisma.ts`.
 *
 * Declared conditionally so that `prisma generate` — which needs no database —
 * still works before credentials are configured. Migration commands will fail
 * with an explicit "datasource is required" error until DIRECT_URL is set.
 */
const directUrl = process.env.DIRECT_URL?.trim();

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});
