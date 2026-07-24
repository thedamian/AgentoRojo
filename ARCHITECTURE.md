# Agento Rojo — Architecture & Interface Contract

Agento Rojo is a locally-run developer tool: it takes an Azure DevOps (dev.azure.com) work item,
enriches it with per-project context stored in SQLite, and dispatches a Claude Code agent running
in GitHub Actions on the mapped repo via `repository_dispatch`. The agent triages the story
(posting clarifying questions back to ADO) or implements it and opens a PR.

Single-user on localhost today; will be deployed for a team later. Therefore: **no secrets stored
on the server**, data layer kept swappable, no single-user assumptions in the schema.

**Language: English only** in all UI text, code, comments, and docs. The product name
"Agento Rojo" is the sole exception (header, README title, package name).

## Workspaces

- `shared/` — TypeScript types, constants, and pure protocol utilities + their Vitest tests.
  Consumed as TS source (`main: src/index.ts`) by both server (tsx) and web (Vite).
- `server/` — Express + better-sqlite3. Port **3001**. Dev: `tsx watch`.
- `web/` — React + Vite + @azure/msal-browser. Port **5173**, Vite proxy `/api` → `http://localhost:3001`.
- `agent-setup/` — three template files users copy into target repos (also served by the API).

## Authentication model

- **ADO**: the browser signs the user in with Entra ID via `@azure/msal-browser` (PKCE SPA) and
  acquires an access token for scope `499b84ac-1321-427f-aa17-267ca6975798/.default`. All ADO
  calls run as the signed-in user.
- **GitHub**: a fine-grained PAT entered by the user, stored in `localStorage` only.
- Every browser→server request carries headers `x-ado-token` and `x-github-token`
  (constants `ADO_TOKEN_HEADER` / `GITHUB_TOKEN_HEADER` in shared). The server uses them
  per-request and **never persists or logs them** — the request logger must redact these headers,
  and a test must prove it.
- On ADO 401 the web client silently re-acquires the token via MSAL and retries **once**.

## Error contract

Every failed server response has body `ApiError` (shared type):

```json
{ "error": "human-readable message", "code": "ADO_UNAUTHORIZED", "retryAfterSeconds": 30 }
```

| code | HTTP | UI message |
|---|---|---|
| `ADO_UNAUTHORIZED` | 401 | "Your Entra session expired — sign in again." |
| `GITHUB_UNAUTHORIZED` | 401 | "GitHub rejected the request — check your GitHub PAT." |
| `NOT_FOUND` | 404 | "Work item / repo not found." (endpoint-specific wording ok) |
| `RATE_LIMITED` | 429 | "Rate limited — retry in {retryAfterSeconds}s." |
| `BAD_REQUEST` | 400 | show `error` text |
| `INTERNAL` | 500 | "Unexpected server error." |

Upstream 401 from ADO ⇒ `ADO_UNAUTHORIZED`; from GitHub ⇒ `GITHUB_UNAUTHORIZED`; upstream 404 ⇒
`NOT_FOUND`; 429 / `Retry-After` ⇒ `RATE_LIMITED` (parse header into `retryAfterSeconds`).
Never leak stack traces or tokens in error bodies.

## Shared pure utilities (in `shared/src/`, re-exported from `index.ts`)

Implemented by the backend builder with Vitest tests in `shared/test/`:

```ts
// ado-url.ts — supports BOTH formats, extra query strings/fragments, trailing slashes:
//   https://dev.azure.com/{org}/{project}/_workitems/edit/{id}
//   https://{org}.visualstudio.com/{project}/_workitems/edit/{id}
// Project segments may be URL-encoded (decode them). Returns null when unparseable.
export function parseAdoWorkItemUrl(url: string): AdoWorkItemRef | null;

// html-to-text.ts — converts ADO HTML field values to readable plain text/markdown:
// <br>, <p>, <div> → newlines; <li> → "- " lines; strips remaining tags; decodes
// common entities (&nbsp; &amp; &lt; &gt; &quot; &#39;); collapses 3+ newlines to 2; trims.
export function htmlToText(html: string | null | undefined): string;

// question-state.ts — deterministic heuristic over oldest-first comments:
// find the LAST comment whose text starts with QUESTION_MARKER; open ⇔ no later comment
// exists that does NOT start with the marker. (The runtime agent applies judgment on top;
// this heuristic only powers a UI notice.)
export function detectQuestionState(comments: WorkItemComment[]): QuestionState;

// payload.ts — if JSON-serialized payload exceeds MAX_PAYLOAD_BYTES (UTF-8 bytes),
// drop comments oldest-first until it fits, set commentsTruncated: true. If it still
// exceeds the cap with zero comments, return it anyway (never throw). Pure — do not
// mutate the input.
export function truncateDispatchPayload(payload: DispatchPayload): DispatchPayload;
```

## SQLite schema (server)

DB file `server/data/agento-rojo.db` (dir auto-created; overridable via env `AGENTO_DB_PATH`;
tests use `:memory:`). Access goes through a repository-style module (`server/src/db/`) so the
data layer is swappable — routes never touch SQL directly.

```sql
settings(key TEXT PRIMARY KEY, value TEXT);                -- e.g. dod_field_name
features(ado_feature_id INTEGER PRIMARY KEY,
         ado_org TEXT, ado_project TEXT,
         feature_title TEXT,
         github_repo TEXT NOT NULL);                        -- "owner/repo"
projects(github_repo TEXT PRIMARY KEY,
         purpose TEXT NOT NULL,
         users_description TEXT NOT NULL,
         created_at TEXT, updated_at TEXT);
dispatches(id INTEGER PRIMARY KEY AUTOINCREMENT,
           work_item_id INTEGER, github_repo TEXT,
           dispatched_at TEXT, payload_json TEXT);          -- audit trail
```

## HTTP API (server implements, web consumes)

All under `/api`. Success bodies are the shared types shown. `:repo` params use
`owner` and `repo` as two path segments (e.g. `/api/projects/octo/my-app`).

| Method & path | Req | Res | Notes |
|---|---|---|---|
| `GET /api/workitem?url=<encoded ADO url>` | headers | `WorkItemDetails` | Parse URL (400 if unparseable). ADO REST v7.1: work item with `$expand=relations`; fields `System.Title`, `System.Description`, `Microsoft.VSTS.Common.AcceptanceCriteria`, `System.WorkItemType`, plus the configured DoD field (settings `dod_field_name`, default `Custom.DefinitionOfDone`; absent ⇒ `definitionOfDone: null`, `dodFieldMissing: true`). Convert HTML fields with `htmlToText`. Fetch ALL comments (Comments API `api-version=7.1-preview.4`, follow `continuationToken` paging), map to `WorkItemComment` oldest-first. Resolve parent via relation `rel === "System.LinkTypes.Hierarchy-Reverse"` (work item id from relation URL), fetch it, and set `parentFeature` only when its `System.WorkItemType === "Feature"`. `visualstudio.com` orgs are called via `https://dev.azure.com/{org}`. |
| `GET /api/settings` | — | `AppSettings` | |
| `PUT /api/settings` | `AppSettings` | `AppSettings` | |
| `GET /api/features/:org/:project/:featureId` | — | `FeatureMapping` | 404 `NOT_FOUND` when unmapped |
| `PUT /api/features/:featureId` | `FeatureMapping` (body wins over param) | `FeatureMapping` | upsert |
| `GET /api/projects` | — | `ProjectContext[]` | admin list |
| `GET /api/projects/:owner/:repo` | — | `ProjectContext` | 404 when absent |
| `PUT /api/projects/:owner/:repo` | `{ purpose, usersDescription }` | `ProjectContext` | upsert; server sets timestamps |
| `GET /api/github/validate-repo?repo=owner/repo` | headers | `RepoValidation` | GET `/repos/{o}/{r}`; 404 ⇒ `{valid:false,message}` with HTTP 200 |
| `GET /api/github/readiness?repo=owner/repo` | headers | `RepoReadiness` | workflow file: GET `/repos/{o}/{r}/contents/.github/workflows/claude-story.yml` (default branch). Variables: GET `/repos/{o}/{r}/actions/variables?per_page=30`; on 403/404 (PAT lacks Variables:read) mark every required variable `present: "unknown"` — do not fail the request. |
| `POST /api/dispatch` | `{ githubRepo: string; payload: DispatchPayload }` | `DispatchRecord` | run `truncateDispatchPayload`, POST `/repos/{o}/{r}/dispatches` `{event_type:"claude-story", client_payload}`, insert audit row, return it |
| `GET /api/dispatches?workItemId=123` | — | `DispatchRecord[]` | newest first |
| `GET /api/github/runs?repo=owner/repo` | headers | `WorkflowRunStatus[]` | GET `/repos/{o}/{r}/actions/workflows/claude-story.yml/runs?per_page=5`; empty array if workflow unknown (404) |
| `GET /api/agent-setup/files` | — | `AgentSetupFile[]` | reads the three files from `agent-setup/` at repo root; `targetPath` e.g. `.github/workflows/claude-story.yml` |

GitHub API base `https://api.github.com`, headers `Authorization: Bearer <pat>`,
`Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.

Client modules: `server/src/clients/ado.ts` and `server/src/clients/github.ts`. The GitHub
client is defined behind an interface (`GitHubClient`) constructed per-request from the token,
so PAT auth can later be swapped for a GitHub App OAuth flow without touching callers.

## Web app flow

1. **Home**: paste-URL input; also reads `?workItemUrl=` from the location and starts the flow.
2. Load `WorkItemDetails`. If `workItemType` is not in `EXPECTED_WORK_ITEM_TYPES`, show what it
   is and let the user proceed anyway or cancel.
3. If `parentFeature` exists → look up mapping; if missing, show mapping form (feature title
   pre-filled, repo validated live via `validate-repo`). If no parent Feature → manual repo
   entry for this story (same validation), which also saves a `features` row keyed by the
   work item's own id is NOT done — instead the flow just uses the chosen repo for this dispatch.
4. If the repo has no `ProjectContext` → ask exactly:
   - "What is the purpose of this application?"
   - "Describe the main users of this application and their role"
   Save via `PUT /api/projects/:owner/:repo`. Editable later from the admin screen.
5. **Readiness check**: workflow file + variables checklist; when not ready, show setup
   instructions rendered from `GET /api/agent-setup/files` with copy buttons.
6. **Review screen**: title, description, AC, DoD (notice when `dodFieldMissing`), comment
   history (with open-questions notice from `detectQuestionState`), project purpose/users,
   target repo, editable "additional notes". Dispatch button → `POST /api/dispatch`.
7. **Status view**: poll `GET /api/github/runs` every ~10s; show latest run status +
   deep link (`htmlUrl`); list past dispatches for the work item.
8. **Settings**: GitHub PAT (list required fine-grained permissions: Contents R/W, Actions Read,
   Metadata Read, Variables Read for the readiness check), Entra sign-out, DoD field name,
   project contexts editor.

MSAL config from Vite env: `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`,
`VITE_ENTRA_REDIRECT_URI` (default `http://localhost:5173`). When `VITE_ENTRA_CLIENT_ID` is
unset, the app runs in a clearly-labeled "Entra not configured (dev stub)" mode: no sign-in,
no ADO token header, banner explaining how to configure `.env`.
