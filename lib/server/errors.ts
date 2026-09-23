/**
 * Domain errors.
 *
 * These sit alongside the auth errors in `lib/auth/errors.ts` and follow the
 * same convention: a `status` field carrying the HTTP meaning, so one mapping
 * table in `lib/server/action.ts` and `lib/server/route.ts` can translate any
 * thrown error into a response without knowing which module raised it.
 *
 * Why these exist at all: without them a service signals failure by returning
 * `null`, and every caller has to decide what a null means. "Patient not found"
 * and "patient exists but you may not see it" then become indistinguishable at
 * the call site, which is exactly the distinction tenant isolation depends on.
 */

/** The thing does not exist, or exists in another tenant. Deliberately the same. */
export class NotFoundError extends Error {
  readonly status = 404;

  constructor(entity = "record") {
    // Worded identically whether the row is absent or belongs to someone else,
    // so a response cannot be used to probe for another tenant's data.
    super(`That ${entity} could not be found.`);
    this.name = "NotFoundError";
  }
}

/** The request conflicts with current state (double booking, duplicate slug). */
export class ConflictError extends Error {
  readonly status = 409;

  constructor(message = "That conflicts with something that already exists.") {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * A business rule refused the operation — an invalid status transition, a stock
 * movement that would go negative, closing an appointment that was cancelled.
 *
 * Distinct from a validation error: the input was well-formed, the *state*
 * disallows it. The message is written for the user and is safe to display.
 */
export class RuleViolationError extends Error {
  readonly status = 422;

  constructor(message: string) {
    super(message);
    this.name = "RuleViolationError";
  }
}

export type DomainError = NotFoundError | ConflictError | RuleViolationError;

export function isDomainError(error: unknown): error is DomainError {
  return (
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof RuleViolationError
  );
}
