import { Router } from "express";
import { parseAdoWorkItemUrl } from "@agento-rojo/shared";
import type { AdoClient } from "../clients/ado.js";
import type { AgentoDb } from "../db/index.js";
import { getSettings } from "../db/index.js";
import { getWorkItemDetails } from "../services/workitem.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../http-error.js";
import { requireAdoToken } from "./token-helpers.js";

export function createWorkItemRouter(db: AgentoDb, createAdoClientFn: (token: string) => AdoClient): Router {
  const router = Router();

  router.get(
    "/workitem",
    asyncHandler(async (req, res) => {
      const url = req.query.url;
      if (typeof url !== "string" || url.length === 0) {
        throw new HttpError(400, "BAD_REQUEST", "Query parameter 'url' is required.");
      }

      const ref = parseAdoWorkItemUrl(url);
      if (!ref) {
        throw new HttpError(400, "BAD_REQUEST", "Could not parse the Azure DevOps work item URL.");
      }

      const token = requireAdoToken(req);
      const adoClient = createAdoClientFn(token);
      const settings = getSettings(db);

      const details = await getWorkItemDetails(adoClient, ref.org, ref.project, ref.id, settings.dodFieldName, url);
      res.json(details);
    }),
  );

  return router;
}
