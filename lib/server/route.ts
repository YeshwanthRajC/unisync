import "server-only";

import { NextResponse } from "next/server";

import { mapError } from "@/lib/server/error-mapping";

/**
 * Error handling for Route Handlers.
 *
 * This is what the `status` fields on `AuthenticationError`, `AuthorizationError`
 * and the domain errors were designed for: a handler catches, and the status the
 * error already carries becomes the HTTP status — no per-route mapping table to
 * keep in sync.
 */
export function toErrorResponse(error: unknown, routeName: string) {
  const mapped = mapError(error, `route:${routeName}`);

  return NextResponse.json(
    {
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.fieldErrors ? { fieldErrors: mapped.fieldErrors } : {}),
      },
    },
    { status: mapped.status },
  );
}
