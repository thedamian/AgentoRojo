import { Router } from "express";
import type { AgentoDb } from "../db/index.js";
import { getProject, listProjects, upsertProject } from "../db/index.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../http-error.js";

export function createProjectsRouter(db: AgentoDb): Router {
  const router = Router();

  router.get(
    "/projects",
    asyncHandler(async (_req, res) => {
      res.json(listProjects(db));
    }),
  );

  router.get(
    "/projects/:owner/:repo",
    asyncHandler(async (req, res) => {
      const githubRepo = `${req.params.owner}/${req.params.repo}`;
      const project = getProject(db, githubRepo);
      if (!project) {
        throw new HttpError(404, "NOT_FOUND", "Project context not found.");
      }
      res.json(project);
    }),
  );

  router.put(
    "/projects/:owner/:repo",
    asyncHandler(async (req, res) => {
      const githubRepo = `${req.params.owner}/${req.params.repo}`;
      const body = req.body as { purpose?: unknown; usersDescription?: unknown } | undefined;

      if (!body || typeof body.purpose !== "string" || typeof body.usersDescription !== "string") {
        throw new HttpError(400, "BAD_REQUEST", "'purpose' and 'usersDescription' are required.");
      }

      res.json(upsertProject(db, githubRepo, body.purpose, body.usersDescription));
    }),
  );

  return router;
}
