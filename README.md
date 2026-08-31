# Agento Rojo

A locally-run developer tool that takes an Azure DevOps (dev.azure.com) work item, enriches it
with per-project context, and dispatches a coding agent running in **GitHub Actions** on the
mapped repository. The agent triages the story — posting clarifying questions back to the ADO
work item if needed — or implements it and opens a pull request. First-run onboarding records the
user's preferred story board, coding location, local agent (when applicable), and Git provider.

Azure DevOps can be accessed with the signed-in user's Entra ID token (MSAL in the browser) or an
ADO PAT. GitHub uses a fine-grained PAT. Browser-supplied credentials stay in localStorage and are
used only on the corresponding request; the server does not persist or log them. The GitHub Actions
agent authenticates to Azure via OIDC → Entra Workload Identity Federation and calls Claude through
a Microsoft Foundry resource.

## Layout

```
package.json      npm workspaces + orchestration scripts
shared/           shared TypeScript types, constants, and pure protocol utilities (+ tests)
server/           Express + better-sqlite3 API (port 3001)
web/              React + Vite UI with Entra sign-in (port 5173, proxies /api to the server)
agent-setup/      the three files you copy into each TARGET repo (workflow, prompt, setup guide)
ARCHITECTURE.md   full interface contract (API, schema, error codes, flows)
```

## First run

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev        # starts server (3001) and web (5173) concurrently
```

Open http://localhost:5173. On first load the connection wizard asks for exactly one story-board,
execution target, and Git-provider choice, then asks for the required credentials. For the current
Azure DevOps → GitHub Actions path, use a **GitHub fine-grained PAT** with these permissions:

- **Contents: Read and write** — required to fire `repository_dispatch`
- **Actions: Read** — to show workflow run status
- **Metadata: Read**
- **Variables: Read** — used by the repo readiness check (optional; without it the variables
  checklist shows "could not verify" and you confirm manually)

### Entra ID sign-in (Azure DevOps access)

Copy `web/.env.example` to `web/.env` and fill in the SPA app registration values
(non-secret configuration):

```
VITE_ENTRA_CLIENT_ID=<SPA app registration client id>
VITE_ENTRA_TENANT_ID=<tenant id>
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
```

The SPA app registration needs delegated Azure DevOps `user_impersonation` permission (admin
consent) and `http://localhost:5173` as a SPA redirect URI — see `agent-setup/SETUP.md`, Azure
admin step 5. Without a configured client id the app runs in a clearly-labeled dev-stub mode:
the UI loads, but ADO calls will report an authorization error.

All ADO reads and comment writes happen **as the signed-in user**. The browser sends the ADO
access token and the GitHub PAT as per-request headers; the server uses them in-flight and never
persists or logs them (the request logger redacts them — enforced by a test).

## Using it

1. Open `http://localhost:5173/?story=<URL-encoded ADO work item URL>` — or paste the URL on the
   home screen. The legacy `workItemUrl` parameter is also supported. Both `dev.azure.com/{org}/...`
   and `{org}.visualstudio.com/...` formats work. After loading one story, entering only a work item
   ID reuses that Azure DevOps project.
2. The app loads the story (title, description, acceptance criteria, Definition of Done, all
   comments) and resolves the parent Feature. If the work item isn't a User Story / Product
   Backlog Item you can proceed anyway or cancel.
3. First time for a Feature: map it to a GitHub repo (`owner/repo`, validated live).
   First time for a repo: answer the two project-context questions (purpose, main users) — these
   are included with every story dispatched to that repo and are editable in Settings.
4. The readiness check verifies the target repo has `.github/workflows/claude-story.yml` and the
   required Actions variables; if not, it shows the setup files with copy buttons.
5. Review everything that will be sent, add optional notes, and **Dispatch**. The payload is
   size-capped (~60 KB): if needed, oldest comments are dropped and the truncation is flagged.
6. The status view polls the workflow run and links to it on github.com, alongside past
   dispatches for the work item.

The Definition of Done field reference name is configurable in Settings
(default `Custom.DefinitionOfDone`) since it is usually a process-template-specific custom field.

## Target repository setup

Each repo the agent should work on needs a one-time setup — full checklists in
`agent-setup/SETUP.md` (also rendered in the app under "Setup files"):

- **Azure admin, once**: an Entra app registration with **federated credentials only** (no
  client secret) trusting GitHub Actions OIDC per target repo; RBAC on the Microsoft Foundry
  resource; the service principal added to the ADO organization with rights to read work items
  and add comments.
- **Developer, per repo**: copy `agent-setup/claude-story.yml` to `.github/workflows/`; add the
  Actions **variables** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
  `ANTHROPIC_FOUNDRY_RESOURCE`, `CLAUDE_MODEL`. **No secrets.**

### How the agent behaves

The workflow triggers only on `repository_dispatch` (event type `claude-story`). The agent runs
a two-phase protocol (see `agent-setup/RUNTIME-PROMPT.md`): it re-fetches the work item comments,
and either posts one `**[claude-agent]** QUESTIONS:` comment with numbered questions and stops —
anyone can answer on the story, then you re-dispatch — or implements the story on a
`story/{id}-{slug}` branch and opens a PR titled `AB#{id}: {title}` (auto-links to the work item
when the Azure Boards↔GitHub connection is configured).

## Scripts

```bash
npm run dev         # server + web, concurrently
npm test            # Vitest: shared (URL parser, HTML→text, question marker, truncation) + server (routes, error mapping, logger redaction)
npm run typecheck   # strict tsc across all workspaces
npm run seed        # inserts an example feature mapping + project context (idempotent)
npm run build       # production builds
```

Data lives in `server/data/agento-rojo.db` (SQLite via better-sqlite3; path overridable with
`AGENTO_DB_PATH`). The data layer sits behind a repository module and the schema has no
single-user assumptions, so it can be swapped/deployed for a team later.
