/** Marker prefix for question comments posted by the agent on ADO work items. */
export const QUESTION_MARKER = "**[claude-agent]** QUESTIONS:";

/** Well-known Azure DevOps application ID, used as the Entra token resource/scope. */
export const ADO_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";

/** MSAL scope for Azure DevOps user-delegated access. */
export const ADO_SCOPE = `${ADO_RESOURCE_ID}/.default`;

/** Actions variables that must exist on a target repo (all non-secret). */
export const REQUIRED_REPO_VARIABLES = [
  "AZURE_CLIENT_ID",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "ANTHROPIC_FOUNDRY_RESOURCE",
  "CLAUDE_MODEL",
] as const;

/** GitHub caps repository_dispatch client_payload size; stay under this. */
export const MAX_PAYLOAD_BYTES = 60_000;

/** Workflow file name expected in the target repo's .github/workflows/. */
export const WORKFLOW_FILE = "claude-story.yml";

/** repository_dispatch event type. */
export const DISPATCH_EVENT_TYPE = "claude-story";

/** Request headers carrying the per-request credentials. Never logged or persisted. */
export const ADO_TOKEN_HEADER = "x-ado-token";
export const GITHUB_TOKEN_HEADER = "x-github-token";

/** Settings keys stored in the SQLite settings table. */
export const SETTING_DOD_FIELD = "dod_field_name";
export const DEFAULT_DOD_FIELD = "Custom.DefinitionOfDone";

/** Work item types considered "expected"; anything else triggers a proceed/cancel warning. */
export const EXPECTED_WORK_ITEM_TYPES = ["User Story", "Product Backlog Item"] as const;
