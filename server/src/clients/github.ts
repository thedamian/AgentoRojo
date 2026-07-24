import type { WorkflowRunStatus } from "@agento-rojo/shared";
import { UpstreamError, retryAfterSecondsFrom } from "./upstream-error.js";

const API_BASE = "https://api.github.com";

export interface GitHubRepo {
  defaultBranch: string;
}

/**
 * GitHub client interface, constructed per-request from the caller's PAT so
 * PAT auth can later be swapped for a GitHub App / OAuth flow without
 * touching callers.
 */
export interface GitHubClient {
  /** Returns null on 404 (repo not found / no access). */
  getRepo(owner: string, repo: string): Promise<GitHubRepo | null>;
  fileExists(owner: string, repo: string, path: string): Promise<boolean>;
  /** Returns "unknown" when the PAT lacks the Variables:read permission (403/404). */
  listVariableNames(owner: string, repo: string): Promise<string[] | "unknown">;
  dispatch(owner: string, repo: string, eventType: string, clientPayload: unknown): Promise<void>;
  /** Returns [] when the workflow file is unknown to GitHub (404). */
  listWorkflowRuns(owner: string, repo: string, workflowFile: string, perPage: number): Promise<WorkflowRunStatus[]>;
}

interface GitHubWorkflowRunJson {
  id: number;
  run_number: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

function upstreamErrorFrom(res: Response): UpstreamError {
  return new UpstreamError(
    "github",
    res.status,
    `GitHub request failed with status ${res.status}`,
    retryAfterSecondsFrom(res.headers),
  );
}

function repoPath(owner: string, repo: string): string {
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/** Constructs a GitHub client authenticated with a fine-grained personal access token. */
export function createGitHubPatClient(token: string): GitHubClient {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  return {
    async getRepo(owner, repo) {
      const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repo)}`, { headers });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw upstreamErrorFrom(res);
      }
      const json = (await res.json()) as { default_branch: string };
      return { defaultBranch: json.default_branch };
    },

    async fileExists(owner, repo, path) {
      const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repo)}/contents/${path}`, { headers });
      if (res.status === 404) {
        return false;
      }
      if (!res.ok) {
        throw upstreamErrorFrom(res);
      }
      return true;
    },

    async listVariableNames(owner, repo) {
      const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repo)}/actions/variables?per_page=30`, { headers });
      if (res.status === 403 || res.status === 404) {
        return "unknown";
      }
      if (!res.ok) {
        throw upstreamErrorFrom(res);
      }
      const json = (await res.json()) as { variables: { name: string }[] };
      return json.variables.map((v) => v.name);
    },

    async dispatch(owner, repo, eventType, clientPayload) {
      const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repo)}/dispatches`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, client_payload: clientPayload }),
      });
      if (res.status !== 204) {
        throw upstreamErrorFrom(res);
      }
    },

    async listWorkflowRuns(owner, repo, workflowFile, perPage) {
      const res = await fetch(
        `${API_BASE}/repos/${repoPath(owner, repo)}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=${perPage}`,
        { headers },
      );
      if (res.status === 404) {
        return [];
      }
      if (!res.ok) {
        throw upstreamErrorFrom(res);
      }
      const json = (await res.json()) as { workflow_runs: GitHubWorkflowRunJson[] };
      return json.workflow_runs.map((run) => ({
        id: run.id,
        runNumber: run.run_number,
        status: run.status,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
        createdAt: run.created_at,
      }));
    },
  };
}
