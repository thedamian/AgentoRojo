import type { NextFunction, Request, Response } from "express";
import type { ApiError } from "@agento-rojo/shared";
import { UpstreamError } from "../clients/upstream-error.js";
import { HttpError } from "../http-error.js";

function mapUpstreamError(err: UpstreamError): { status: number; body: ApiError } {
  if (err.status === 401 && err.source === "ado") {
    return { status: 401, body: { error: "Your Entra session expired — sign in again.", code: "ADO_UNAUTHORIZED" } };
  }
  if (err.status === 401 && err.source === "github") {
    return {
      status: 401,
      body: { error: "GitHub rejected the request — check your GitHub PAT.", code: "GITHUB_UNAUTHORIZED" },
    };
  }
  if (err.status === 404) {
    return { status: 404, body: { error: "Work item / repo not found.", code: "NOT_FOUND" } };
  }
  if (err.status === 429) {
    const body: ApiError = {
      error:
        err.retryAfterSeconds !== undefined
          ? `Rate limited — retry in ${err.retryAfterSeconds}s.`
          : "Rate limited — please retry shortly.",
      code: "RATE_LIMITED",
    };
    if (err.retryAfterSeconds !== undefined) {
      body.retryAfterSeconds = err.retryAfterSeconds;
    }
    return { status: 429, body };
  }
  return { status: 500, body: { error: "Unexpected server error.", code: "INTERNAL" } };
}

/**
 * Central error handler. Converts UpstreamError (from the ADO/GitHub clients)
 * and HttpError (thrown directly by route handlers) into the shared
 * ApiError response contract. Never leaks stack traces or token values.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof UpstreamError) {
    const { status, body } = mapUpstreamError(err);
    res.status(status).json(body);
    return;
  }

  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message, code: err.code };
    if (err.retryAfterSeconds !== undefined) {
      body.retryAfterSeconds = err.retryAfterSeconds;
    }
    res.status(err.status).json(body);
    return;
  }

  const body: ApiError = { error: "Unexpected server error.", code: "INTERNAL" };
  res.status(500).json(body);
}
