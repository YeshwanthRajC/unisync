import { z } from "zod";

/**
 * Validated access to environment variables.
 *
 * Two rules this module exists to enforce:
 *
 *  1. Secrets never reach the browser. Every server accessor throws if it is
 *     ever evaluated in a client bundle, so an accidental import from a Client
 *     Component fails loudly in development instead of leaking a key.
 *
 *  2. Validation is LAZY, not module-load-time. Eager parsing would make
 *     `next build` fail on a machine that has not configured credentials yet,
 *     and would break `npm run build` in CI. Instead each accessor validates on
 *     first use and memoises, so a missing variable surfaces as a precise error
 *     in the one code path that actually needs it.
 */

const nonEmpty = z.string().trim().min(1);

// ---------------------------------------------------------------------------
// Public (browser-visible) variables
// ---------------------------------------------------------------------------

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedPublicEnv: PublicEnv | undefined;

/**
 * Next.js inlines `NEXT_PUBLIC_*` only where `process.env.X` appears
 * literally in source, so these must be spelled out rather than iterated.
 */
function readPublicEnv() {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    cachedPublicEnv = parseOrThrow(publicEnvSchema, readPublicEnv(), "public");
  }
  return cachedPublicEnv;
}

// ---------------------------------------------------------------------------
// Server-only variables
// ---------------------------------------------------------------------------

/**
 * Server variables are validated in INDEPENDENT GROUPS, one per dependency.
 *
 * A single combined schema looks tidier but couples unrelated subsystems: an
 * empty `DATABASE_URL` would make the Gemini provider throw about a missing
 * database, and the AI agent could not be exercised until Postgres credentials
 * existed. Grouping keeps the promise this module is built on — a missing
 * variable fails only the code path that actually needs it.
 */

const databaseEnvSchema = z.object({
  DATABASE_URL: nonEmpty,
  DIRECT_URL: nonEmpty,
});

const aiEnvSchema = z.object({
  GEMINI_API_KEY: nonEmpty,
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.8-flash"),
});

const brevoEnvSchema = z.object({
  BREVO_API_KEY: z.string().trim().optional(),
  BREVO_MCP_API_KEY: z.string().trim().optional(),
  BREVO_SENDER_EMAIL: z.string().trim().email().default("yeshwanthgamer0@gmail.com"),
  BREVO_SENDER_NAME: z.string().trim().default("UniSync Clinic"),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type AiEnv = z.infer<typeof aiEnvSchema>;
export type BrevoEnv = z.infer<typeof brevoEnvSchema>;

let cachedDatabaseEnv: DatabaseEnv | undefined;
let cachedAiEnv: AiEnv | undefined;
let cachedBrevoEnv: BrevoEnv | undefined;

/** Connection strings for Prisma. Runtime queries use the pooled URL. */
export function getDatabaseEnv(): DatabaseEnv {
  assertServer("getDatabaseEnv");
  cachedDatabaseEnv ??= parseOrThrow(databaseEnvSchema, process.env, "server");
  return cachedDatabaseEnv;
}

/** Credentials for the active LLM provider. */
export function getAiEnv(): AiEnv {
  assertServer("getAiEnv");
  cachedAiEnv ??= parseOrThrow(aiEnvSchema, process.env, "server");
  return cachedAiEnv;
}

/** Credentials and sender identity for Brevo email & MCP services. */
export function getBrevoEnv(): BrevoEnv {
  assertServer("getBrevoEnv");
  cachedBrevoEnv ??= parseOrThrow(brevoEnvSchema, process.env, "server");
  return cachedBrevoEnv;
}

/**
 * The RLS-bypassing service role key, or `undefined` when unset.
 *
 * Deliberately returns `undefined` rather than throwing: it is optional, and
 * the one caller that needs it raises its own, more specific error.
 */
export function getServiceRoleKey(): string | undefined {
  assertServer("getServiceRoleKey");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key ? key : undefined;
}

function assertServer(accessor: string): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `${accessor}() was called in the browser. Server secrets must never be ` +
        "imported into a Client Component.",
    );
  }
}

// ---------------------------------------------------------------------------
// Configuration probes
// ---------------------------------------------------------------------------

/**
 * Non-throwing checks used by the health endpoint and by setup screens, so the
 * app can report "not configured yet" instead of crashing during bring-up.
 */
export function isSupabaseConfigured(): boolean {
  return publicEnvSchema.safeParse(readPublicEnv()).success;
}

export function isDatabaseConfigured(): boolean {
  return nonEmpty.safeParse(process.env.DATABASE_URL).success;
}

export function isGeminiConfigured(): boolean {
  return nonEmpty.safeParse(process.env.GEMINI_API_KEY).success;
}

export function isBrevoConfigured(): boolean {
  const key = process.env.BREVO_API_KEY?.trim();
  const mcpKey = process.env.BREVO_MCP_API_KEY?.trim();
  return Boolean((key && key.length > 0) || (mcpKey && mcpKey.length > 0));
}

export function isBrevoMcpConfigured(): boolean {
  const mcpKey = process.env.BREVO_MCP_API_KEY?.trim();
  return Boolean(mcpKey && mcpKey.length > 0);
}

// ---------------------------------------------------------------------------

function parseOrThrow<T extends z.ZodType>(
  schema: T,
  value: unknown,
  scope: "public" | "server",
): z.infer<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  // Report only the variable NAMES that failed. Values are never logged.
  const missing = result.error.issues
    .map((issue) => issue.path.join("."))
    .filter((name, index, all) => name && all.indexOf(name) === index);

  throw new Error(
    `Invalid or missing ${scope} environment variables: ${missing.join(", ")}. ` +
      "Copy .env.example to .env.local and fill in the values.",
  );
}
