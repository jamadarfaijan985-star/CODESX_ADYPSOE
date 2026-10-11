/**
 * Normalized error for every authentication operation.
 * UI code can rely on `status`, `code`, `fieldErrors` and `retryAfter`
 * regardless of which adapter (real backend or development mock) produced it.
 */
export class AuthError extends Error {
  constructor(
    message,
    { status = 0, code = "", fieldErrors = null, retryAfter = null } = {},
  ) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfter = retryAfter;
  }
}

export function isAuthError(error) {
  return error instanceof AuthError;
}
