import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isDatabaseConfigured,
  isGeminiConfigured,
  isSupabaseConfigured,
} from "@/lib/env";

/**
 * Temporary bring-up page.
 *
 * It exists so the development environment can be verified at a glance, and
 * will be replaced by the marketing/landing route once the auth module lands.
 */

// The status below reflects runtime configuration, so it must not be frozen
// into a static prerender at build time.
export const dynamic = "force-dynamic";

const checks = [
  {
    name: "Supabase",
    hint: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ready: isSupabaseConfigured,
  },
  {
    name: "Database",
    hint: "DATABASE_URL, DIRECT_URL",
    ready: isDatabaseConfigured,
  },
  {
    name: "Gemini",
    hint: "GEMINI_API_KEY",
    ready: isGeminiConfigured,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">UniSync</h1>
        <p className="text-muted-foreground text-sm">
          Administrative operations for small organizations, with an AI
          assistant alongside. Development environment.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((check) => {
            const ready = check.ready();
            return (
              <div
                key={check.name}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <div>
                  <p className="font-medium">{check.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {check.hint}
                  </p>
                </div>
                <span
                  className={
                    ready
                      ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground text-xs font-medium"
                  }
                >
                  {ready ? "configured" : "not configured"}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Live dependency check, including database connectivity:{" "}
        <a className="underline underline-offset-4" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
