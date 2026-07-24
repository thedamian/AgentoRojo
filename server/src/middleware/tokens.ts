import type { NextFunction, Request, Response } from "express";
import { ADO_TOKEN_HEADER, GITHUB_TOKEN_HEADER } from "@agento-rojo/shared";

declare global {
  namespace Express {
    interface Request {
      /** Bearer token for Azure DevOps, read from the x-ado-token header. Per-request only. */
      adoToken?: string;
      /** GitHub PAT, read from the x-github-token header. Per-request only. */
      githubToken?: string;
    }
  }
}

/** Reads the per-request auth token headers into typed request fields. Never persisted or logged. */
export function tokenContext(req: Request, _res: Response, next: NextFunction): void {
  const adoToken = req.header(ADO_TOKEN_HEADER);
  const githubToken = req.header(GITHUB_TOKEN_HEADER);
  req.adoToken = adoToken && adoToken.length > 0 ? adoToken : undefined;
  req.githubToken = githubToken && githubToken.length > 0 ? githubToken : undefined;
  next();
}
