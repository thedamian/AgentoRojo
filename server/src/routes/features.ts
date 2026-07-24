import { Router } from "express";
import type { FeatureMapping } from "@agento-rojo/shared";
import type { AgentoDb } from "../db/index.js";
import { getFeature, upsertFeature } from "../db/index.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../http-error.js";

const REPO_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export function createFeaturesRouter(db: AgentoDb): Router {
  const router = Router();

  router.get(
    "/features/:org/:project/:featureId",
    asyncHandler(async (req, res) => {
      const { org, project, featureId: featureIdParam } = req.params;
      const featureId = Number.parseInt(featureIdParam ?? "", 10);
      if (!org || !project || !Number.isFinite(featureId)) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid feature id.");
      }

      const mapping = getFeature(db, org, project, featureId);
      if (!mapping) {
        throw new HttpError(404, "NOT_FOUND", "Feature mapping not found.");
      }
      res.json(mapping);
    }),
  );

  router.put(
    "/features/:featureId",
    asyncHandler(async (req, res) => {
      const paramFeatureId = Number.parseInt(req.params.featureId ?? "", 10);
      const body = req.body as Partial<FeatureMapping> | undefined;

      if (
        !body ||
        typeof body.adoOrg !== "string" ||
        typeof body.adoProject !== "string" ||
        typeof body.featureTitle !== "string" ||
        typeof body.githubRepo !== "string"
      ) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid feature mapping body.");
      }

      if (!REPO_PATTERN.test(body.githubRepo)) {
        throw new HttpError(400, "BAD_REQUEST", "'githubRepo' must be in 'owner/repo' format.");
      }

      // Body wins over the URL param when both specify an id.
      const adoFeatureId = typeof body.adoFeatureId === "number" ? body.adoFeatureId : paramFeatureId;
      if (!Number.isFinite(adoFeatureId)) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid feature id.");
      }

      const mapping: FeatureMapping = {
        adoFeatureId,
        adoOrg: body.adoOrg,
        adoProject: body.adoProject,
        featureTitle: body.featureTitle,
        githubRepo: body.githubRepo,
      };

      res.json(upsertFeature(db, mapping));
    }),
  );

  return router;
}
