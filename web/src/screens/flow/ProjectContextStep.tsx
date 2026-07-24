import { useEffect, useState, type FormEvent } from "react";
import type { ProjectContext } from "@agento-rojo/shared";
import { ApiClientError, friendlyMessage, getProject, putProject } from "../../api/client";

interface Props {
  repo: string;
  onResolved: (project: ProjectContext) => void;
}

/** Loads the repo's saved ProjectContext, or asks the two required questions once. */
export default function ProjectContextStep({ repo, onResolved }: Props) {
  const [state, setState] = useState<"loading" | "form" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [usersDescription, setUsersDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    getProject(repo)
      .then((project) => {
        if (!cancelled) {
          onResolved(project);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiClientError && err.apiError.code === "NOT_FOUND") {
          setState("form");
        } else {
          setError(friendlyMessage(err));
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const project = await putProject(repo, { purpose, usersDescription });
      onResolved(project);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") {
    return <p>Loading project context for {repo}…</p>;
  }
  if (state === "error") {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <section className="step">
      <h2>Project context for {repo}</h2>
      <p>This repo has no saved project context yet. It will be reused for future work items in this repo.</p>
      <form onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span>What is the purpose of this application?</span>
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
        </label>
        <label className="field">
          <span>Describe the main users of this application and their role</span>
          <textarea value={usersDescription} onChange={(e) => setUsersDescription(e.target.value)} required />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </section>
  );
}
