import { ZodError } from "zod";

import { AiProviderError } from "@/lib/ai/types";
import { isAuthError } from "@/lib/auth/errors";
import { isDomainError } from "@/lib/server/errors";
import type { ActionError } from "@/lib/server/result";

/**
 * The single place an exception becomes a response.
 *
 * Shared by the Server Action wrapper and the Route Handler wrapper so a
 * `NotFoundError` means the same thing whether it surfaced through a form or an
 * HTTP endpoint.
 *
 * The important rule is the last branch: an unrecognised error NEVER has its
 * message forwarded. Prisma exceptions quote column names, constraint names and
 * sometimes the offending value; a connection failure quotes the host. Those are
 * useful in a log and are an information leak in a response.
 */

export type MappedError = ActionError & { status: number };

export function mapError(error: unknown, logContext: string): MappedError {
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: "VALIDATION",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrorsFrom(error),
    };
  }

  if (isAuthError(error)) {
    return {
      status: error.status,
      code: error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      // These messages are written as user-facing copy and deliberately reveal
      // nothing about other tenants.
      message: error.message,
    };
  }

  if (isDomainError(error)) {
    const code =
      error.status === 404
        ? "NOT_FOUND"
        : error.status === 409
          ? "CONFLICT"
          : "RULE_VIOLATION";
    return { status: error.status, code, message: error.message };
  }

  if (error instanceof AiProviderError) {
    return {
      status: error.status,
      code: "PROVIDER",
      message: "The assistant is unavailable right now. Please try again.",
    };
  }

  // Unrecognised. Log it in full, return nothing specific.
  const reference = crypto.randomUUID().slice(0, 8);
  console.error(
    `[${logContext}] unhandled error (ref ${reference})`,
    error instanceof Error ? error.stack : error,
  );

  return {
    status: 500,
    code: "UNEXPECTED",
    message: `Something went wrong. Reference: ${reference}`,
  };
}

/**
 * Build per-field messages from a Zod failure.
 *
 * Reads `error.issues` directly rather than calling `flatten()`, whose shape has
 * changed between Zod majors — a silent change there would drop every form
 * validation message without failing a build.
 */
function fieldErrorsFrom(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}
