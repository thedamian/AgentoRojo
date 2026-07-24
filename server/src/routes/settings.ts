import { Router } from "express";
import type { AppSettings } from "@agento-rojo/shared";
import type { AgentoDb } from "../db/index.js";
import { getSettings, setSettings } from "../db/index.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../http-error.js";

export function createSettingsRouter(db: AgentoDb): Router {
  const router = Router();

  router.get(
    "/settings",
    asyncHandler(async (_req, res) => {
      res.json(getSettings(db));
    }),
  );

  router.put(
    "/settings",
    asyncHandler(async (req, res) => {
      const body = req.body as Partial<AppSettings> | undefined;
      if (!body || typeof body.dodFieldName !== "string" || body.dodFieldName.trim().length === 0) {
        throw new HttpError(400, "BAD_REQUEST", "'dodFieldName' is required.");
      }
      res.json(setSettings(db, { dodFieldName: body.dodFieldName }));
    }),
  );

  return router;
}
