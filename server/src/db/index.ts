import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_DOD_FIELD, SETTING_DOD_FIELD } from "@agento-rojo/shared";
import type { AppSettings, DispatchPayload, DispatchRecord, FeatureMapping, ProjectContext } from "@agento-rojo/shared";

export type AgentoDb = Database.Database;

/** Opens (creating if needed) the SQLite database at `path`, creates the schema, and seeds defaults. */
export function openDb(path: string): AgentoDb {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  createSchema(db);
  seedDefaultSettings(db);
  return db;
}

function createSchema(db: AgentoDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS features (
      ado_feature_id INTEGER PRIMARY KEY,
      ado_org TEXT,
      ado_project TEXT,
      feature_title TEXT,
      github_repo TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      github_repo TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      users_description TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_item_id INTEGER,
      github_repo TEXT,
      dispatched_at TEXT,
      payload_json TEXT
    );
  `);
}

function seedDefaultSettings(db: AgentoDb): void {
  const existing = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTING_DOD_FIELD);
  if (!existing) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(SETTING_DOD_FIELD, DEFAULT_DOD_FIELD);
  }
}

// --- settings ---

export function getSettings(db: AgentoDb): AppSettings {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTING_DOD_FIELD) as
    | { value: string }
    | undefined;
  return { dodFieldName: row?.value ?? DEFAULT_DOD_FIELD };
}

export function setSettings(db: AgentoDb, settings: AppSettings): AppSettings {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(SETTING_DOD_FIELD, settings.dodFieldName);
  return getSettings(db);
}

// --- features ---

interface FeatureRow {
  ado_feature_id: number;
  ado_org: string;
  ado_project: string;
  feature_title: string;
  github_repo: string;
}

function rowToFeature(row: FeatureRow): FeatureMapping {
  return {
    adoFeatureId: row.ado_feature_id,
    adoOrg: row.ado_org,
    adoProject: row.ado_project,
    featureTitle: row.feature_title,
    githubRepo: row.github_repo,
  };
}

export function getFeature(db: AgentoDb, org: string, project: string, featureId: number): FeatureMapping | null {
  const row = db
    .prepare("SELECT * FROM features WHERE ado_feature_id = ? AND ado_org = ? AND ado_project = ?")
    .get(featureId, org, project) as FeatureRow | undefined;
  return row ? rowToFeature(row) : null;
}

export function upsertFeature(db: AgentoDb, mapping: FeatureMapping): FeatureMapping {
  db.prepare(
    `INSERT INTO features (ado_feature_id, ado_org, ado_project, feature_title, github_repo)
     VALUES (@adoFeatureId, @adoOrg, @adoProject, @featureTitle, @githubRepo)
     ON CONFLICT(ado_feature_id) DO UPDATE SET
       ado_org = excluded.ado_org,
       ado_project = excluded.ado_project,
       feature_title = excluded.feature_title,
       github_repo = excluded.github_repo`,
  ).run(mapping);
  return mapping;
}

// --- projects ---

interface ProjectRow {
  github_repo: string;
  purpose: string;
  users_description: string;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): ProjectContext {
  return {
    githubRepo: row.github_repo,
    purpose: row.purpose,
    usersDescription: row.users_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(db: AgentoDb): ProjectContext[] {
  const rows = db.prepare("SELECT * FROM projects ORDER BY github_repo").all() as ProjectRow[];
  return rows.map(rowToProject);
}

export function getProject(db: AgentoDb, githubRepo: string): ProjectContext | null {
  const row = db.prepare("SELECT * FROM projects WHERE github_repo = ?").get(githubRepo) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function upsertProject(db: AgentoDb, githubRepo: string, purpose: string, usersDescription: string): ProjectContext {
  const existing = getProject(db, githubRepo);
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt ?? now;
  db.prepare(
    `INSERT INTO projects (github_repo, purpose, users_description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(github_repo) DO UPDATE SET
       purpose = excluded.purpose,
       users_description = excluded.users_description,
       updated_at = excluded.updated_at`,
  ).run(githubRepo, purpose, usersDescription, createdAt, now);
  const result = getProject(db, githubRepo);
  if (!result) {
    throw new Error("Failed to upsert project context.");
  }
  return result;
}

// --- dispatches ---

interface DispatchRow {
  id: number;
  work_item_id: number;
  github_repo: string;
  dispatched_at: string;
  payload_json: string;
}

function rowToDispatch(row: DispatchRow): DispatchRecord {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    githubRepo: row.github_repo,
    dispatchedAt: row.dispatched_at,
    payload: JSON.parse(row.payload_json) as DispatchPayload,
  };
}

export function insertDispatch(
  db: AgentoDb,
  workItemId: number,
  githubRepo: string,
  dispatchedAt: string,
  payload: DispatchPayload,
): DispatchRecord {
  const result = db
    .prepare("INSERT INTO dispatches (work_item_id, github_repo, dispatched_at, payload_json) VALUES (?, ?, ?, ?)")
    .run(workItemId, githubRepo, dispatchedAt, JSON.stringify(payload));
  return {
    id: Number(result.lastInsertRowid),
    workItemId,
    githubRepo,
    dispatchedAt,
    payload,
  };
}

export function listDispatchesByWorkItem(db: AgentoDb, workItemId: number): DispatchRecord[] {
  const rows = db
    .prepare("SELECT * FROM dispatches WHERE work_item_id = ? ORDER BY id DESC")
    .all(workItemId) as DispatchRow[];
  return rows.map(rowToDispatch);
}
