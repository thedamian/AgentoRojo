import type { AdoWorkItemRef } from "./types.js";

/**
 * Parses an Azure DevOps work item URL in either of the two supported formats:
 *   https://dev.azure.com/{org}/{project}/_workitems/edit/{id}
 *   https://{org}.visualstudio.com/{project}/_workitems/edit/{id}
 *
 * Tolerates URL-encoded project segments, trailing slashes, and extra query
 * strings / fragments after the id. Returns null when the URL does not match
 * either shape or the id segment is not a positive integer.
 */
export function parseAdoWorkItemUrl(url: string): AdoWorkItemRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter((segment) => segment.length > 0);

  let org: string | null = null;
  let remaining: string[] = [];

  if (host === "dev.azure.com") {
    if (segments.length < 1) {
      return null;
    }
    org = decodeURIComponent(segments[0] ?? "");
    remaining = segments.slice(1);
  } else if (host.endsWith(".visualstudio.com")) {
    const orgFromHost = host.slice(0, host.length - ".visualstudio.com".length);
    if (!orgFromHost) {
      return null;
    }
    org = orgFromHost;
    remaining = segments;
  } else {
    return null;
  }

  // remaining should be: {project}/_workitems/edit/{id}
  if (remaining.length < 4) {
    return null;
  }

  const [projectRaw, workItemsSegment, editSegment, idRaw] = remaining;
  if (workItemsSegment !== "_workitems" || editSegment !== "edit") {
    return null;
  }
  if (!projectRaw || !idRaw) {
    return null;
  }

  const project = decodeURIComponent(projectRaw);

  if (!/^\d+$/.test(idRaw)) {
    return null;
  }
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  if (!org || !project) {
    return null;
  }

  return { org, project, id };
}
