import { Router } from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentSetupFile } from "@agento-rojo/shared";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../http-error.js";

interface FileSpec {
  name: string;
  relativePath: string;
  targetPath: string;
}

const FILES: FileSpec[] = [
  {
    name: "claude-story.yml",
    relativePath: "agent-setup/claude-story.yml",
    targetPath: ".github/workflows/claude-story.yml",
  },
  {
    name: "RUNTIME-PROMPT.md",
    relativePath: "agent-setup/RUNTIME-PROMPT.md",
    targetPath: "(reference — embedded in the workflow prompt)",
  },
  {
    name: "SETUP.md",
    relativePath: "agent-setup/SETUP.md",
    targetPath: "(reference — setup checklist)",
  },
];

/** `repoRoot` is the AgentoRojo repository root, where the `agent-setup/` directory lives. */
export function createAgentSetupRouter(repoRoot: string): Router {
  const router = Router();

  router.get(
    "/agent-setup/files",
    asyncHandler(async (_req, res) => {
      const files: AgentSetupFile[] = FILES.map((spec) => {
        const fullPath = join(repoRoot, spec.relativePath);
        let content: string;
        try {
          content = readFileSync(fullPath, "utf8");
        } catch {
          throw new HttpError(500, "INTERNAL", `Setup file not found on disk: ${spec.relativePath}`);
        }
        return { name: spec.name, targetPath: spec.targetPath, content };
      });
      res.json(files);
    }),
  );

  return router;
}
