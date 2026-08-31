import { UpstreamError, retryAfterSecondsFrom } from "./upstream-error.js";

export interface AdoRelation {
  rel: string;
  url: string;
}

export interface AdoWorkItem {
  id: number;
  fields: Record<string, unknown>;
  relations?: AdoRelation[];
}

export interface AdoComment {
  id: number;
  text: string;
  createdBy?: { displayName?: string };
  createdDate: string;
}

/**
 * Azure DevOps client, bound to a single caller's bearer token. Talks to
 * `https://dev.azure.com/{org}` (visualstudio.com orgs are addressed through
 * this same host — the org segment is all that changes).
 */
export interface AdoClient {
  getWorkItem(org: string, project: string, id: number): Promise<AdoWorkItem>;
  /** Fetches every comment page, returned oldest-first. */
  getComments(org: string, project: string, id: number): Promise<AdoComment[]>;
}

interface AdoCommentsPage {
  comments: AdoComment[];
  continuationToken?: string;
}

function upstreamErrorFrom(res: Response): UpstreamError {
  return new UpstreamError("ado", res.status, `ADO request failed with status ${res.status}`, retryAfterSecondsFrom(res.headers));
}

function authorizationHeader(token: string): string {
  // Browser clients prefix Azure DevOps PATs so the server can distinguish them from an
  // Entra access token without persisting either secret. ADO accepts Basic base64(:PAT).
  if (token.startsWith("pat:")) {
    return `Basic ${Buffer.from(`:${token.slice(4)}`).toString("base64")}`;
  }
  return `Bearer ${token}`;
}

async function adoFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: authorizationHeader(token),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw upstreamErrorFrom(res);
  }
  return (await res.json()) as T;
}

export function createAdoClient(token: string): AdoClient {
  return {
    async getWorkItem(org, project, id) {
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`;
      return adoFetch<AdoWorkItem>(url, token);
    },

    async getComments(org, project, id) {
      const comments: AdoComment[] = [];
      let continuationToken: string | undefined;

      do {
        const tokenParam = continuationToken ? `&continuationToken=${encodeURIComponent(continuationToken)}` : "";
        const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.4${tokenParam}`;
        const page = await adoFetch<AdoCommentsPage>(url, token);
        comments.push(...page.comments);
        continuationToken = page.continuationToken;
      } while (continuationToken);

      comments.sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
      return comments;
    },
  };
}
