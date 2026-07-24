import { useEffect, useState } from "react";
import type { DispatchRecord, WorkflowRunStatus } from "@agento-rojo/shared";
import { friendlyMessage, getRuns, listDispatches } from "../../api/client";

interface Props {
  workItemId: number;
  repo: string;
}

const POLL_INTERVAL_MS = 10_000;

/** Polls the latest workflow run for the repo and lists past dispatches for the work item. */
export default function StatusScreen({ workItemId, repo }: Props) {
  const [runs, setRuns] = useState<WorkflowRunStatus[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRecord[] | null>(null);
  const [dispatchesError, setDispatchesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function pollRuns() {
      try {
        const result = await getRuns(repo);
        if (!cancelled) {
          setRuns(result);
          setRunsError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setRunsError(friendlyMessage(err));
        }
      }
    }
    void pollRuns();
    const interval = setInterval(() => void pollRuns(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    listDispatches(workItemId)
      .then((result) => {
        if (!cancelled) {
          setDispatches(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDispatchesError(friendlyMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workItemId]);

  const latest = runs && runs.length > 0 ? (runs[0] ?? null) : null;

  return (
    <section className="step">
      <h2>Run status — {repo}</h2>
      {runsError && (
        <p className="error" role="alert">
          {runsError}
        </p>
      )}
      {runs && runs.length === 0 && <p>The run may take a moment to appear.</p>}
      {latest && (
        <div className="run-status">
          <span className={`badge status-${latest.status}`}>
            {latest.status}
            {latest.conclusion ? ` / ${latest.conclusion}` : ""}
          </span>
          <a href={latest.htmlUrl} target="_blank" rel="noreferrer">
            View run on GitHub
          </a>
        </div>
      )}

      <h3>Past dispatches for this work item</h3>
      {dispatchesError && (
        <p className="error" role="alert">
          {dispatchesError}
        </p>
      )}
      {dispatches && dispatches.length === 0 && <p>No past dispatches.</p>}
      {dispatches && dispatches.length > 0 && (
        <ul className="dispatch-list">
          {dispatches.map((d) => (
            <li key={d.id}>
              {new Date(d.dispatchedAt).toLocaleString()} — {d.githubRepo}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
