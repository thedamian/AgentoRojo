import { useEffect, useState } from "react";
import type { WorkItemDetails } from "@agento-rojo/shared";
import { getWorkItem, friendlyMessage } from "../api/client";

interface Props {
  onLoaded: (workItem: WorkItemDetails) => void;
}

/** URL input + "Load work item" button; also auto-starts from ?workItemUrl= on mount. */
export default function HomeScreen({ onLoaded }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(targetUrl: string) {
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const workItem = await getWorkItem(trimmed);
      onLoaded(workItem);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // URLSearchParams.get() already URL-decodes the value.
    const fromQuery = new URLSearchParams(window.location.search).get("workItemUrl");
    if (fromQuery) {
      setUrl(fromQuery);
      void load(fromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="step">
      <h1>Load a work item</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(url);
        }}
      >
        <label className="field">
          <span>Azure DevOps work item URL</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://dev.azure.com/org/project/_workitems/edit/123"
          />
        </label>
        <button type="submit" disabled={loading || !url.trim()}>
          {loading ? "Loading…" : "Load work item"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
