import { Router, type Request } from "express";
import { REQUIRED_REPO_VARIABLES, WORKFLOW_FILE } from "@agento-rojo/shared";
import type { RepoReadiness, RepoValidation, VariableCheck, WorkflowRunStatus } from "@agento-rojo/shared";
import type { GitHubClient } from "../clients/github.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../http-error.js";
import { requireGithubToken } from "./token-helpers.js";

const REPO_QUERY_PATTERN = /^[^/\s]+\/[^/\s]+$/;

function parseRepoQuery(req: Request): { owner: string; repo: string } {
  const repoParam = req.query.repo;
  if (typeof repoParam !== "string" || !REPO_QUERY_PATTERN.test(repoParam)) {
    throw new HttpError(400, "BAD_REQUEST", "Query parameter 'repo' must be in 'owner/repo' format.");
  }
  const [owner, repo] = repoParam.split("/") as [string, string];
  return { owner, repo };
}

export function createGithubRouter(createGitHubClientFn: (token: string) => GitHubClient): Router {
  const router = Router();

  router.get(
    "/github/validate-repo",
    asyncHandler(async (req, res) => {
      const { owner, repo } = parseRepoQuery(req);
      const token = requireGithubToken(req);
      const client = createGitHubClientFn(token);

      const info = await client.getRepo(owner, repo);
      const body: RepoValidation = info
        ? { valid: true, defaultBranch: info.defaultBranch }
        : { valid: false, message: `Repository '${owner}/${repo}' not found.` };
      res.json(body);
    }),
  );

  router.get(
    "/github/readiness",
    asyncHandler(async (req, res) => {
      const { owner, repo } = parseRepoQuery(req);
      const token = requireGithubToken(req);
      const client = createGitHubClientFn(token);

      const workflowFileExists = await client.fileExists(owner, repo, `.github/workflows/${WORKFLOW_FILE}`);
      const variableNames = await client.listVariableNames(owner, repo);

      const variables: VariableCheck[] =
        variableNames === "unknown"
          ? REQUIRED_REPO_VARIABLES.map((name) => ({ name, present: "unknown" as const }))
          : REQUIRED_REPO_VARIABLES.map((name) => ({ name, present: variableNames.includes(name) }));

      const body: RepoReadiness = { workflowFileExists, variables };
      res.json(body);
    }),
  );

  router.get(
    "/github/runs",
    asyncHandler(async (req, res) => {
      const { owner, repo } = parseRepoQuery(req);
      const token = requireGithubToken(req);
      const client = createGitHubClientFn(token);

      const runs: WorkflowRunStatus[] = await client.listWorkflowRuns(owner, repo, WORKFLOW_FILE, 5);
      res.json(runs);
    }),
  );

  return router;
}
