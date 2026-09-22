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

export function isAuthError(
  error: unknown,
): error is AuthenticationError | AuthorizationError {
  return (
    error instanceof AuthenticationError || error instanceof AuthorizationError
  );
}
