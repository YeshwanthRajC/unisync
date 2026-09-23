/**
 * Errors the server layer throws when a request is not allowed to proceed.
 * They carry an HTTP status so Route Handlers can map them without each one
 * re-deciding what a failure means.
 */

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Signed in, but a member of no organization at all.
 *
 * A subclass of AuthorizationError so every existing catch and the error-mapping
 * table keep working unchanged, but distinguishable — because the right response
 * is completely different. "You lack permission for this" is a dead end; "you
 * have not created your clinic yet" is an onboarding step. Without the
 * distinction the guard would have to send a brand-new user to a no-access page.
 */
export class NoOrganizationError extends AuthorizationError {
  constructor() {
    super("Your account does not belong to any organization yet.");
    this.name = "NoOrganizationError";
  }
}

export function isAuthError(
  error: unknown,
): error is AuthenticationError | AuthorizationError {
  return (
    error instanceof AuthenticationError || error instanceof AuthorizationError
  );
}
