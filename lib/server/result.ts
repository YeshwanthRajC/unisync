/**
 * The shape every Server Action returns.
 *
 * Server Actions must RETURN failures rather than throw them. A thrown error
 * does not cross the server/client boundary intact: Next.js replaces the message
 * with a generic one plus a digest in production, so `error instanceof
 * AuthorizationError` is unreachable on the client and the user would see
 * "something went wrong" for a recoverable validation failure.
 *
 * This module is isomorphic on purpose — Client Components import it to narrow
 * the result — so it must never import anything server-only.
 */

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RULE_VIOLATION"
  | "PROVIDER"
  | "RATE_LIMITED"
  | "UNEXPECTED";

export type ActionError = {
  code: ActionErrorCode;
  /** Safe to render to the user. Never a raw exception message. */
  message: string;
  /** Per-field messages from a Zod failure, for form display. */
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error: { code, message, fieldErrors } };
}
