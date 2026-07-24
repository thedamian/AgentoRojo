import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, upsertFeature, upsertProject } from "./db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, "..", "data", "agento-rojo.db");
const dbPath = process.env.AGENTO_DB_PATH ?? defaultDbPath;

const db = openDb(dbPath);

const EXAMPLE_REPO = "example-org/example-repo";

upsertFeature(db, {
  adoFeatureId: 1,
  adoOrg: "example-org",
  adoProject: "Example Project",
  featureTitle: "Example Feature",
  githubRepo: EXAMPLE_REPO,
});

upsertProject(
  db,
  EXAMPLE_REPO,
  "Example purpose: a sample application used to validate the Agento Rojo dispatch pipeline end to end.",
  "Example users: internal developers exercising the dispatch and readiness flows.",
);

console.log(`Seed complete: example feature mapping and project context for '${EXAMPLE_REPO}' inserted (idempotent).`);

db.close();
