import type { ApiErrorCode } from "@agento-rojo/shared";

/**
 * Error thrown directly by route handlers for validation / not-found cases
 * (as opposed to UpstreamError, which comes from the ADO/GitHub clients).
 * Caught by the central error handler and mapped to the ApiError contract.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: ApiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
