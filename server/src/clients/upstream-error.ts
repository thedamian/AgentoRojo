/**
 * Typed error thrown by the ADO and GitHub clients when an upstream request
 * fails. Carries just enough information (source, HTTP status, optional
 * Retry-After) for the central error handler to map it to the ApiError
 * contract — never the response body, which may contain sensitive details.
 */
export class UpstreamError extends Error {
  readonly source: "ado" | "github";
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(source: "ado" | "github", status: number, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "UpstreamError";
    this.source = source;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Parses the Retry-After header (seconds form) into a number, if present and valid. */
export function retryAfterSecondsFrom(headers: { get(name: string): string | null }): number | undefined {
  const header = headers.get("retry-after");
  if (!header) {
    return undefined;
  }
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}
