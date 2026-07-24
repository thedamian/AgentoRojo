import { useEffect, useState } from "react";
import type { AgentSetupFile, RepoReadiness } from "@agento-rojo/shared";
import { friendlyMessage, getAgentSetupFiles, getReadiness } from "../../api/client";
import CopyButton from "../../components/CopyButton";

interface Props {
  repo: string;
  onReady: () => void;
}

/** Pre-dispatch checklist: workflow file + required Actions variables. */
export default function ReadinessStep({ repo, onReady }: Props) {
  const [readiness, setReadiness] = useState<RepoReadiness | null>(null);
  const [setupFiles, setSetupFiles] = useState<AgentSetupFile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const result = await getReadiness(repo);
      setReadiness(result);
      if (!result.workflowFileExists) {
        setSetupFiles(await getAgentSetupFiles());
      }
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  if (loading) {
    return <p>Checking repository readiness…</p>;
  }
  if (error) {
    return (
      <div>
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" onClick={() => void check()}>
          Retry
        </button>
      </div>
    );
  }
  if (!readiness) {
    return null;
  }

  const blocked = !readiness.workflowFileExists;

  return (
    <section className="step">
      <h2>Repository readiness — {repo}</h2>
      <ul className="checklist">
        <li>
          {readiness.workflowFileExists ? "✓" : "✗"} Workflow file (.github/workflows/claude-story.yml)
        </li>
        {readiness.variables.map((v) => (
          <li key={v.name}>
            {v.present === true ? "✓" : v.present === "unknown" ? "?" : "✗"} {v.name}
            {v.present === "unknown" && (
              <span className="hint">
                {" "}
                — Could not verify — grant the PAT Variables: read permission or verify manually
              </span>
            )}
          </li>
        ))}
      </ul>
      {blocked && setupFiles && (
        <div className="setup-files">
          <p>
            The workflow file is missing from this repo. Copy the files below into it before dispatching.
          </p>
          {setupFiles.map((f) => (
            <div key={f.name} className="setup-file">
              <h3>
                {f.name} <span className="hint">→ {f.targetPath}</span>
              </h3>
              <pre>{f.content}</pre>
              <CopyButton text={f.content} />
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <button type="button" className="secondary" onClick={() => void check()}>
          Re-check
        </button>
        <button type="button" onClick={onReady} disabled={blocked}>
          Continue
        </button>
      </div>
    </section>
  );
}
