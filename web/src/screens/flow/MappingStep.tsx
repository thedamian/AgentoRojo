import { useEffect, useState, type FormEvent } from "react";
import type { WorkItemDetails } from "@agento-rojo/shared";
import { ApiClientError, friendlyMessage, getFeatureMapping, putFeatureMapping } from "../../api/client";
import RepoInput from "../../components/RepoInput";

interface Props {
  workItem: WorkItemDetails;
  onResolved: (repo: string) => void;
}

type Status = "loading" | "needsForm" | "noParent" | "error";

/**
 * Resolves the target GitHub repo for this work item:
 * - has a parent Feature: look up its saved mapping, or show a save-once form.
 * - no parent Feature: ask for a repo used only for this dispatch (nothing saved).
 */
export default function MappingStep({ workItem, onResolved }: Props) {
  const parent = workItem.parentFeature;
  const [status, setStatus] = useState<Status>(parent ? "loading" : "noParent");
  const [error, setError] = useState<string | null>(null);
  const [featureTitle, setFeatureTitle] = useState(parent?.title ?? "");
  const [repo, setRepo] = useState("");
  const [repoValid, setRepoValid] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!parent) {
      return;
    }
    let cancelled = false;
    getFeatureMapping(workItem.org, workItem.project, parent.id)
      .then((mapping) => {
        if (!cancelled) {
          onResolved(mapping.githubRepo);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiClientError && err.apiError.code === "NOT_FOUND") {
          setStatus("needsForm");
        } else {
          setError(friendlyMessage(err));
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent?.id, workItem.org, workItem.project]);

  async function saveMapping(e: FormEvent) {
    e.preventDefault();
    if (!parent) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const mapping = await putFeatureMapping(parent.id, {
        adoFeatureId: parent.id,
        adoOrg: workItem.org,
        adoProject: workItem.project,
        featureTitle,
        githubRepo: repo.trim(),
      });
      onResolved(mapping.githubRepo);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return <p>Looking up the feature → repo mapping…</p>;
  }
  if (status === "error") {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }

  if (status === "needsForm") {
    return (
      <section className="step">
        <h2>Map parent feature to a GitHub repo</h2>
        <p>No repo is mapped yet for feature "{parent?.title}" (#{parent?.id}).</p>
        <form onSubmit={(e) => void saveMapping(e)}>
          <label className="field">
            <span>Feature title</span>
            <input type="text" value={featureTitle} onChange={(e) => setFeatureTitle(e.target.value)} required />
          </label>
          <RepoInput value={repo} onChange={setRepo} onValidChange={setRepoValid} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={!repoValid || saving}>
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="step">
      <h2>Choose target repo</h2>
      <p className="notice">No parent Feature found — choose the target repo for this story.</p>
      <RepoInput value={repo} onChange={setRepo} onValidChange={setRepoValid} />
      <div className="actions">
        <button type="button" disabled={!repoValid} onClick={() => onResolved(repo.trim())}>
          Continue
        </button>
      </div>
    </section>
  );
}
