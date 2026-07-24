/** Reference to an Azure DevOps work item parsed from a URL. */
export interface AdoWorkItemRef {
  org: string;
  project: string;
  id: number;
}

/** A single comment on an ADO work item, ordered oldest-first. */
export interface WorkItemComment {
  id: number;
  author: string;
  createdDate: string; // ISO 8601
  text: string; // plain text (converted from HTML)
}

/** Parent feature resolved via System.LinkTypes.Hierarchy-Reverse, only when the parent's type is Feature. */
export interface ParentFeature {
  id: number;
  title: string;
}

/** Everything the server extracts for one work item. */
export interface WorkItemDetails {
  id: number;
  org: string;
  project: string;
  url: string;
  title: string;
  description: string; // plain text/markdown, converted from HTML
  acceptanceCriteria: string; // plain text, converted from HTML; empty string if absent
  definitionOfDone: string | null; // null when the configured DoD field is absent
  dodFieldMissing: boolean; // true when the configured DoD field was not on the work item
  workItemType: string; // e.g. "User Story", "Product Backlog Item", "Bug"
  comments: WorkItemComment[];
  parentFeature: ParentFeature | null;
}

/** Feature → GitHub repo mapping (features table). */
export interface FeatureMapping {
  adoFeatureId: number;
  adoOrg: string;
  adoProject: string;
  featureTitle: string;
  githubRepo: string; // "owner/repo"
}

/** Per-repo project context (projects table). */
export interface ProjectContext {
  githubRepo: string; // "owner/repo"
  purpose: string; // answer to "What is the purpose of this application?"
  usersDescription: string; // answer to "Describe the main users of this application and their role"
  createdAt: string;
  updatedAt: string;
}

/** client_payload sent via repository_dispatch. */
export interface DispatchPayload {
  workItemId: number;
  workItemUrl: string;
  adoOrg: string;
  adoProject: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  definitionOfDone: string | null;
  comments: WorkItemComment[];
  /** Set when the comment history was truncated (oldest-first) to fit the payload size cap. */
  commentsTruncated?: boolean;
  projectPurpose: string;
  projectUsers: string;
  additionalNotes: string;
}

/** Audit-trail row (dispatches table). */
export interface DispatchRecord {
  id: number;
  workItemId: number;
  githubRepo: string;
  dispatchedAt: string;
  payload: DispatchPayload;
}

export type VariableCheck = {
  name: string;
  /** "unknown" when the PAT lacks the Variables: read permission. */
  present: boolean | "unknown";
};

/** Result of the pre-dispatch repo readiness check. */
export interface RepoReadiness {
  workflowFileExists: boolean;
  variables: VariableCheck[];
}

/** Latest workflow run info for the status view. */
export interface WorkflowRunStatus {
  id: number;
  runNumber: number;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | ... | null while running
  htmlUrl: string;
  createdAt: string;
}

export type ApiErrorCode =
  | "ADO_UNAUTHORIZED"
  | "GITHUB_UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL";

/** Error body returned by every server endpoint on failure. */
export interface ApiError {
  error: string;
  code: ApiErrorCode;
  retryAfterSeconds?: number;
}

/** Settings exposed to the UI. */
export interface AppSettings {
  dodFieldName: string;
}

/** Result of validating an "owner/repo" against the GitHub API. */
export interface RepoValidation {
  valid: boolean;
  defaultBranch?: string;
  message?: string;
}

/** One template file from agent-setup/, rendered on the setup screen. */
export interface AgentSetupFile {
  name: string;
  targetPath: string; // where the user should place it in the target repo
  content: string;
}

/** Outcome of the question-marker detection heuristic over an ordered comment list. */
export interface QuestionState {
  /** True when the most recent [claude-agent] QUESTIONS comment has no later non-agent comment. */
  hasOpenQuestions: boolean;
  lastQuestionCommentId: number | null;
}
