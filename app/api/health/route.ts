import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import {
  isDatabaseConfigured,
  isGeminiConfigured,
  isSupabaseConfigured,
} from "@/lib/env";

/**
 * Bring-up and liveness check.
 *
 * Reports only whether each dependency is CONFIGURED and REACHABLE. It never
 * echoes a URL, key, or connection string — the response is safe to read in a
 * terminal or a browser without leaking anything.
 */

export const dynamic = "force-dynamic";

type DependencyStatus = {
  configured: boolean;
  reachable?: boolean;
  detail?: string;
};

export async function GET() {
  const supabase: DependencyStatus = { configured: isSupabaseConfigured() };
  const gemini: DependencyStatus = { configured: isGeminiConfigured() };
  const database: DependencyStatus = { configured: isDatabaseConfigured() };

  if (database.configured) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database.reachable = true;
    } catch (error) {
      database.reachable = false;
      // The message can contain a host name but never a password, because
      // Prisma redacts credentials in connection errors.
      database.detail =
        error instanceof Error ? error.message.split("\n")[0] : "Unknown error";
    }
  }

  const ready = supabase.configured && gemini.configured && database.reachable === true;

  return NextResponse.json(
    {
      app: "UniSync",
      status: ready ? "ready" : "setup_incomplete",
      dependencies: { supabase, database, gemini },
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
