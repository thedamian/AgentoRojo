import { useEffect, useState } from "react";
import type { WorkItemDetails } from "@agento-rojo/shared";
import { getWorkItem, friendlyMessage } from "../api/client";
import type { ConnectionProfile } from "../auth/connectionProfile";

interface Props {
  profile: ConnectionProfile;
  onLoaded: (workItem: WorkItemDetails) => void;
  onProfileChanged: (profile: ConnectionProfile) => void;
}

function isAdoUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "dev.azure.com" || host.endsWith(".visualstudio.com");
  } catch {
    return false;
  }
}

function urlForWorkItemId(id: string, lastStoryUrl?: string): string | null {
  if (!lastStoryUrl) return null;
  try {
    const url = new URL(lastStoryUrl);
    const segments = url.pathname.split("/");
    const editIndex = segments.findIndex((segment) => segment.toLowerCase() === "edit");
    if (editIndex === -1) return null;
    segments[editIndex + 1] = id;
    url.pathname = segments.join("/");
    return url.toString();
  } catch {
    return null;
  }
}

/** Supports ?story=, legacy ?workItemUrl=, story URLs, and known-project numeric ids. */
export default function HomeScreen({ profile, onLoaded, onProfileChanged }: Props) {
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(rawTarget: string) {
    const entered = rawTarget.trim();
    if (!entered) return;
    if (profile.storyBoard === "jira") {
      setError("Jira is selected. Connect the Jira adapter before loading a Jira issue; Azure DevOps stories can be loaded in this build.");
      return;
    }
    const target = /^\d+$/.test(entered) ? urlForWorkItemId(entered, profile.lastStoryUrl) : entered;
    if (!target) {
      setError("Enter the full Azure DevOps story URL once. After that, you can enter only the work item ID.");
      return;
    }
    if (!isAdoUrl(target)) {
      setError("Enter an Azure DevOps work item URL or a numeric work item ID for the last Azure DevOps project you used.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const workItem = await getWorkItem(target);
      onProfileChanged({ ...profile, lastStoryUrl: target });
      onLoaded(workItem);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("story") ?? params.get("workItemUrl");
    if (fromQuery) {
      setStory(fromQuery);
      void load(fromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="home step">
      <p className="eyebrow">Connected to {profile.storyBoard === "jira" ? "Jira" : "Azure DevOps"}</p>
      <h1>What story should we work on?</h1>
      <p className="lead">
        Paste the {profile.storyBoard === "jira" ? "Jira" : "Azure DevOps"} story URL.
        {profile.lastStoryUrl && profile.storyBoard === "azure-devops"
          ? " You can also enter a work item ID for the Azure DevOps project you used last."
          : " We’ll read the story, its parent context, comments, and attachments before planning the work."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(story);
        }}
      >
        <label className="field">
          <span>{profile.storyBoard === "jira" ? "Jira story URL or ID" : "Azure DevOps story URL or ID"}</span>
          <input
            type="text"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder={profile.storyBoard === "jira" ? "https://your-team.atlassian.net/browse/PROJ-123" : "https://dev.azure.com/org/project/_workitems/edit/123"}
          />
        </label>
        <button type="submit" disabled={loading || !story.trim()}>
          {loading ? "Reading story…" : "Read story and start planning"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="connection-summary">
        <span>Story board: <strong>{profile.storyBoard === "jira" ? "Jira" : "Azure DevOps"}</strong></span>
        <span>Work runs: <strong>{profile.executionTarget === "local" ? `locally with ${profile.localCodingAgent === "claude-code" ? "Claude Code" : profile.localCodingAgent === "other" ? "a compatible CLI" : "Codex"}` : profile.executionTarget === "claude" ? "with Claude" : "with OpenAI"}</strong></span>
        <span>Repository: <strong>{profile.gitProvider === "azure-devops" ? "Azure DevOps Git" : profile.gitProvider}</strong></span>
      </div>
    </section>
  );
}
