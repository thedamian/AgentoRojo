import { ADO_TOKEN_HEADER, GITHUB_TOKEN_HEADER } from "@agento-rojo/shared";
import type {
  AgentSetupFile,
  ApiError,
  AppSettings,
  DispatchPayload,
  DispatchRecord,
  FeatureMapping,
  ProjectContext,
  RepoReadiness,
  RepoValidation,
  WorkflowRunStatus,
  WorkItemDetails,
} from "@agento-rojo/shared";
import { getGithubPat } from "../auth/githubPat";
import { getConnectionProfile } from "../auth/connectionProfile";
import { acquireAdoToken } from "../auth/msal";

/** Thrown for every non-OK response; carries the parsed ApiError body. */
export class ApiClientError extends Error {
  readonly apiError: ApiError;
  readonly status: number;

  constructor(apiError: ApiError, status: number) {
    super(apiError.error);
    this.name = "ApiClientError";
    this.apiError = apiError;
    this.status = status;
  }
}

/** Maps an error (ideally an ApiClientError) to the ARCHITECTURE.md error-contract message. */
export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    switch (err.apiError.code) {
      case "ADO_UNAUTHORIZED":
        return "Your Entra session expired — sign in again.";
      case "GITHUB_UNAUTHORIZED":
        return "GitHub rejected the request — check your GitHub PAT.";
      case "NOT_FOUND":
        return err.apiError.error || "Work item / repo not found.";
      case "RATE_LIMITED":
        return err.apiError.retryAfterSeconds !== undefined
          ? `Rate limited — retry in ${err.apiError.retryAfterSeconds}s.`
          : "Rate limited — please retry shortly.";
      case "BAD_REQUEST":
        return err.apiError.error;
      case "INTERNAL":
        return "Unexpected server error.";
      default:
        return err.apiError.error;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unexpected error.";
}

function splitRepo(repo: string): [string, string] {
  const idx = repo.indexOf("/");
  return idx === -1 ? [repo, ""] : [repo.slice(0, idx), repo.slice(idx + 1)];
}

interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.pathname + url.search;
}

async function buildHeaders(forceRefreshAdo: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const pat = getGithubPat();
  if (pat) {
    headers[GITHUB_TOKEN_HEADER] = pat;
  }
  const adoToken = await acquireAdoToken(forceRefreshAdo);
  if (adoToken) {
    headers[ADO_TOKEN_HEADER] = adoToken;
  } else {
    const profile = getConnectionProfile();
    // The server recognizes the prefix and uses HTTP Basic PAT authentication. The value is
    // request-scoped and follows the same redaction/no-persistence guarantees as Entra tokens.
    if (profile?.storyBoard === "azure-devops" && profile.boardCredential?.trim()) {
      headers[ADO_TOKEN_HEADER] = `pat:${profile.boardCredential.trim()}`;
    }
  }
  return headers;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const headers = await buildHeaders(isRetry);
  const init: RequestInit = { method: options.method ?? "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(buildUrl(path, options.query), init);

  if (res.ok) {
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  let apiError: ApiError;
  try {
    apiError = (await res.json()) as ApiError;
  } catch {
    apiError = { error: "Unexpected server error.", code: "INTERNAL" };
  }

  if (res.status === 401 && apiError.code === "ADO_UNAUTHORIZED" && !isRetry) {
    return request<T>(path, options, true);
  }

  throw new ApiClientError(apiError, res.status);
}

export function getWorkItem(url: string): Promise<WorkItemDetails> {
  return request<WorkItemDetails>("/workitem", { query: { url } });
}

export function getSettings(): Promise<AppSettings> {
  return request<AppSettings>("/settings");
}

export function putSettings(settings: AppSettings): Promise<AppSettings> {
  return request<AppSettings>("/settings", { method: "PUT", body: settings });
}

export function getFeatureMapping(org: string, project: string, featureId: number): Promise<FeatureMapping> {
  return request<FeatureMapping>(
    `/features/${encodeURIComponent(org)}/${encodeURIComponent(project)}/${featureId}`,
  );
}

export function putFeatureMapping(featureId: number, mapping: FeatureMapping): Promise<FeatureMapping> {
  return request<FeatureMapping>(`/features/${featureId}`, { method: "PUT", body: mapping });
}

export function listProjects(): Promise<ProjectContext[]> {
  return request<ProjectContext[]>("/projects");
}

export function getProject(repo: string): Promise<ProjectContext> {
  const [owner, name] = splitRepo(repo);
  return request<ProjectContext>(`/projects/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
}

export function putProject(
  repo: string,
  data: { purpose: string; usersDescription: string },
): Promise<ProjectContext> {
  const [owner, name] = splitRepo(repo);
  return request<ProjectContext>(`/projects/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: data,
  });
}

export function validateRepo(repo: string): Promise<RepoValidation> {
  return request<RepoValidation>("/github/validate-repo", { query: { repo } });
}

export function getReadiness(repo: string): Promise<RepoReadiness> {
  return request<RepoReadiness>("/github/readiness", { query: { repo } });
}

export function dispatch(args: { githubRepo: string; payload: DispatchPayload }): Promise<DispatchRecord> {
  return request<DispatchRecord>("/dispatch", { method: "POST", body: args });
}

export function listDispatches(workItemId: number): Promise<DispatchRecord[]> {
  return request<DispatchRecord[]>("/dispatches", { query: { workItemId } });
}

export function getRuns(repo: string): Promise<WorkflowRunStatus[]> {
  return request<WorkflowRunStatus[]>("/github/runs", { query: { repo } });
}

export function getAgentSetupFiles(): Promise<AgentSetupFile[]> {
  return request<AgentSetupFile[]>("/agent-setup/files");
}
