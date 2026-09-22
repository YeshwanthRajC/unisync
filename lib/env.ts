import { z } from "zod";

/**
 * Validated access to environment variables.
 *
 * Two rules this module exists to enforce:
 *
 *  1. Secrets never reach the browser. `getServerEnv()` throws if it is ever
 *     evaluated in a client bundle, so an accidental import from a Client
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

const serverEnvSchema = z.object({
  DATABASE_URL: nonEmpty,
  DIRECT_URL: nonEmpty,
  GEMINI_API_KEY: nonEmpty,
  GEMINI_MODEL: z.string().trim().default("gemini-2.5-flash"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServerEnv() was called in the browser. Server secrets must never be " +
        "imported into a Client Component.",
    );
  }
  if (!cachedServerEnv) {
    cachedServerEnv = parseOrThrow(serverEnvSchema, process.env, "server");
  }
  return cachedServerEnv;
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
