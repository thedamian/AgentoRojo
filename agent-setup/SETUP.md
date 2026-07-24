# Agento Rojo — Target Repository Setup

Zero secrets in target repos. Authentication to Azure happens via GitHub OIDC → Entra
Workload Identity Federation (no client secrets, no PATs, no `anthropic_api_key`).

## One-time Azure setup (Azure admin)

Copy this checklist into a request to your Azure administrator:

1. Create an Entra **app registration** (or user-assigned managed identity) named
   "Agento Rojo Agent". No client secret — federated credentials only.
2. Add a **federated credential** per target repo trusting GitHub Actions OIDC:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:{owner}/{repo}:ref:refs/heads/{default-branch}` (repository_dispatch
     runs on the default branch)

   Each new target repo = one new federated credential entry on this same app.
3. Grant the app's service principal the RBAC role required to call Claude model
   deployments on the **Microsoft Foundry resource** (e.g. the Foundry / Cognitive
   Services user-level role your org uses).
4. Add the same service principal as a **user in the Azure DevOps organization** (ADO
   supports service principals/managed identities), Basic access level, with permission to
   view work items and add comments in the relevant projects.
5. Separately: create a **SPA app registration** for the Agento Rojo webapp itself (MSAL
   sign-in) with delegated Azure DevOps `user_impersonation` permission and admin consent;
   redirect URIs `http://localhost:5173` now, the production URL later.

## Per-repo setup (developer)

1. Copy `claude-story.yml` into `.github/workflows/` on the default branch.
2. Add repo **Actions variables** (Settings → Secrets and variables → Actions →
   Variables): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
   `ANTHROPIC_FOUNDRY_RESOURCE`, `CLAUDE_MODEL`. **No secrets.**
3. Ask the Azure admin to add this repo's federated credential (step 2 above).
4. Recommended: install the Claude GitHub App on the repo for cleaner PR authoring;
   otherwise the default `GITHUB_TOKEN` with the workflow's permissions block is used.
5. Ensure GitHub Actions are enabled for the repo.
