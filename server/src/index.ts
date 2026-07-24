import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { openDb } from "./db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, "..", "data", "agento-rojo.db");
const dbPath = process.env.AGENTO_DB_PATH ?? defaultDbPath;

const db = openDb(dbPath);
const app = createApp({ db });

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;

app.listen(port, () => {
  console.log(`Agento Rojo server listening on port ${port}`);
});
