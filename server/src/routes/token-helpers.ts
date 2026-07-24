import type { Request } from "express";
import { HttpError } from "../http-error.js";

/** Returns the ADO token from the request context, or throws ADO_UNAUTHORIZED when absent. */
export function requireAdoToken(req: Request): string {
  if (!req.adoToken) {
    throw new HttpError(401, "ADO_UNAUTHORIZED", "Missing Azure DevOps access token.");
  }
  return req.adoToken;
}

/** Returns the GitHub token from the request context, or throws GITHUB_UNAUTHORIZED when absent. */
export function requireGithubToken(req: Request): string {
  if (!req.githubToken) {
    throw new HttpError(401, "GITHUB_UNAUTHORIZED", "Missing GitHub token.");
  }
  return req.githubToken;
}
