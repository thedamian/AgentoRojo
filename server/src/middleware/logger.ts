import type { NextFunction, Request, Response } from "express";
import { ADO_TOKEN_HEADER, GITHUB_TOKEN_HEADER } from "@agento-rojo/shared";

const REDACTED = "[REDACTED]";
const SENSITIVE_HEADERS = new Set([ADO_TOKEN_HEADER, GITHUB_TOKEN_HEADER, "authorization", "cookie", "set-cookie"]);

export type LogSink = (message: string) => void;

/**
 * Returns a shallow copy of `headers` with the ADO/GitHub token header values
 * replaced by "[REDACTED]". Used by the request logger so token values never
 * reach a log sink, even if headers are included in the log line.
 */
export function redactHeaders(headers: Record<string, string | string[] | undefined>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return result;
}

/**
 * Express request logger. Logs `method path status durationMs` plus the
 * request headers with auth tokens redacted. Tokens are never persisted or
 * echoed anywhere else.
 */
export function createRequestLogger(sink: LogSink = console.log): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const start = Date.now();
    // Captured up front: Express only restores req.path/req.url to the full
    // mounted path when a matched route calls next(). A route that ends the
    // response directly (the common case) leaves req.path stripped of any
    // mount prefix (e.g. "/api") by the time the async "finish" event fires.
    // req.originalUrl is never rewritten by router mounting, so it is safe
    // to read at any point in the request lifecycle.
    const path = req.originalUrl.split("?")[0] ?? req.originalUrl;
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      const headers = redactHeaders(req.headers as Record<string, string | string[] | undefined>);
      sink(
        JSON.stringify({
          method: req.method,
          path,
          status: res.statusCode,
          durationMs,
          headers,
        }),
      );
    });
    next();
  };
}
