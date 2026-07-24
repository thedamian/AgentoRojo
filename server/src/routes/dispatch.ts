import { Router } from "express";
import { DISPATCH_EVENT_TYPE, truncateDispatchPayload } from "@agento-rojo/shared";
import type { DispatchPayload, DispatchRecord } from "@agento-rojo/shared";
import type { AgentoDb } from "../db/index.js";
import { insertDispatch, listDispatchesByWorkItem } from "../db/index.js";
import type { GitHubClient } from "../clients/github.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../http-error.js";
import { requireGithubToken } from "./token-helpers.js";

const REPO_PATTERN = /^[^/\s]+\/[^/\s]+$/;

function isValidDispatchPayload(payload: unknown): payload is DispatchPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const p = payload as Record<string, unknown>;
  return (
    typeof p.workItemId === "number" &&
    typeof p.workItemUrl === "string" &&
    typeof p.adoOrg === "string" &&
    typeof p.adoProject === "string" &&
    typeof p.title === "string" &&
    typeof p.description === "string" &&
    typeof p.acceptanceCriteria === "string" &&
    (p.definitionOfDone === null || typeof p.definitionOfDone === "string") &&
    Array.isArray(p.comments) &&
    typeof p.projectPurpose === "string" &&
    typeof p.projectUsers === "string" &&
    typeof p.additionalNotes === "string"
  );
}

export function createDispatchRouter(db: AgentoDb, createGitHubClientFn: (token: string) => GitHubClient): Router {
  const router = Router();

  router.post(
    "/dispatch",
    asyncHandler(async (req, res) => {
      const body = req.body as { githubRepo?: unknown; payload?: unknown } | undefined;

      if (!body || typeof body.githubRepo !== "string" || !REPO_PATTERN.test(body.githubRepo)) {
        throw new HttpError(400, "BAD_REQUEST", "'githubRepo' must be in 'owner/repo' format.");
      }
      if (!isValidDispatchPayload(body.payload)) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid dispatch payload.");
      }

      const token = requireGithubToken(req);
      const client = createGitHubClientFn(token);
      const [owner, repo] = body.githubRepo.split("/") as [string, string];

      const truncatedPayload = truncateDispatchPayload(body.payload);
      await client.dispatch(owner, repo, DISPATCH_EVENT_TYPE, truncatedPayload);

      const dispatchedAt = new Date().toISOString();
      const record: DispatchRecord = insertDispatch(
        db,
        truncatedPayload.workItemId,
        body.githubRepo,
        dispatchedAt,
        truncatedPayload,
      );
      res.json(record);
    }),
  );

  router.get(
    "/dispatches",
    asyncHandler(async (req, res) => {
      const workItemIdRaw = req.query.workItemId;
      const workItemId = typeof workItemIdRaw === "string" ? Number.parseInt(workItemIdRaw, 10) : NaN;
      if (!Number.isFinite(workItemId)) {
        throw new HttpError(400, "BAD_REQUEST", "Query parameter 'workItemId' must be a number.");
      }
      res.json(listDispatchesByWorkItem(db, workItemId));
    }),
  );

  return router;
}
