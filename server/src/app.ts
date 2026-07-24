import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentoDb } from "./db/index.js";
import type { AdoClient } from "./clients/ado.js";
import type { GitHubClient } from "./clients/github.js";
import { createAdoClient } from "./clients/ado.js";
import { createGitHubPatClient } from "./clients/github.js";
import { tokenContext } from "./middleware/tokens.js";
import { createRequestLogger, type LogSink } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errors.js";
import { createWorkItemRouter } from "./routes/workitem.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createFeaturesRouter } from "./routes/features.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createGithubRouter } from "./routes/github.js";
import { createDispatchRouter } from "./routes/dispatch.js";
import { createAgentSetupRouter } from "./routes/agent-setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src -> server -> repo root
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Dependencies injected into the app factory — real implementations by default, mocks in tests. */
export interface AppDeps {
  db: AgentoDb;
  createAdoClient?: (token: string) => AdoClient;
  createGitHubClient?: (token: string) => GitHubClient;
  /** Repo root containing agent-setup/; defaults to the AgentoRojo project root. */
  repoRoot?: string;
  logSink?: LogSink;
}

/** Express app factory. Clients and the db are injectable so tests can supply mocks. */
export function createApp(deps: AppDeps): Express {
  const app = express();

  const adoClientFactory = deps.createAdoClient ?? createAdoClient;
  const githubClientFactory = deps.createGitHubClient ?? createGitHubPatClient;
  const repoRoot = deps.repoRoot ?? DEFAULT_REPO_ROOT;

  app.use(express.json());
  app.use(createRequestLogger(deps.logSink));
  app.use(tokenContext);

  app.use("/api", createWorkItemRouter(deps.db, adoClientFactory));
  app.use("/api", createSettingsRouter(deps.db));
  app.use("/api", createFeaturesRouter(deps.db));
  app.use("/api", createProjectsRouter(deps.db));
  app.use("/api", createGithubRouter(githubClientFactory));
  app.use("/api", createDispatchRouter(deps.db, githubClientFactory));
  app.use("/api", createAgentSetupRouter(repoRoot));

  app.use(errorHandler);

  return app;
}
