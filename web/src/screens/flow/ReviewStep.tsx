import { useState } from "react";
import { detectQuestionState } from "@agento-rojo/shared";
import type { DispatchPayload, DispatchRecord, ProjectContext, WorkItemDetails } from "@agento-rojo/shared";
import { dispatch, friendlyMessage } from "../../api/client";

interface Props {
  workItem: WorkItemDetails;
  repo: string;
  projectContext: ProjectContext;
  onDispatched: (record: DispatchRecord) => void;
}

/** Final review of everything that will be sent to the agent, plus the dispatch action. */
export default function ReviewStep({ workItem, repo, projectContext, onDispatched }: Props) {
  const [notes, setNotes] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionState = detectQuestionState(workItem.comments);

  async function handleDispatch() {
    setDispatching(true);
    setError(null);
    const payload: DispatchPayload = {
      workItemId: workItem.id,
      workItemUrl: workItem.url,
      adoOrg: workItem.org,
      adoProject: workItem.project,
      title: workItem.title,
      description: workItem.description,
      acceptanceCriteria: workItem.acceptanceCriteria,
      definitionOfDone: workItem.definitionOfDone,
      comments: workItem.comments,
      projectPurpose: projectContext.purpose,
      projectUsers: projectContext.usersDescription,
      additionalNotes: notes,
    };
    try {
      const record = await dispatch({ githubRepo: repo, payload });
      onDispatched(record);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setDispatching(false);
    }
  }

  return (
    <section className="step review-step">
      <h2>Review — {workItem.title}</h2>

      <div className="review-block">
        <h3>Title</h3>
        <p>{workItem.title}</p>
      </div>

      <div className="review-block">
        <h3>Description</h3>
        <p className="pre-wrap">{workItem.description || "—"}</p>
      </div>

      <div className="review-block">
        <h3>Acceptance Criteria</h3>
        <p className="pre-wrap">{workItem.acceptanceCriteria || "—"}</p>
      </div>

      <div className="review-block">
        <h3>Definition of Done</h3>
        {workItem.dodFieldMissing && (
          <p className="notice">
            The configured Definition of Done field (settings) was not found on this work item — proceeding
            without it.
          </p>
        )}
        <p className="pre-wrap">{workItem.definitionOfDone ?? "—"}</p>
      </div>

      <div className="review-block">
        <h3>Comment history</h3>
        {questionState.hasOpenQuestions && (
          <p className="notice">
            This story has unanswered agent questions — the agent will re-ask them instead of implementing.
          </p>
        )}
        {workItem.comments.length === 0 ? (
          <p>No comments.</p>
        ) : (
          <ul className="comments">
            {workItem.comments.map((c) => (
              <li key={c.id}>
                <strong>{c.author}</strong> — {new Date(c.createdDate).toLocaleString()}
                <p className="pre-wrap">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="review-block">
        <h3>Project purpose</h3>
        <p className="pre-wrap">{projectContext.purpose}</p>
      </div>

      <div className="review-block">
        <h3>Main users</h3>
        <p className="pre-wrap">{projectContext.usersDescription}</p>
      </div>

      <div className="review-block">
        <h3>Target repo</h3>
        <p>{repo}</p>
      </div>

      <label className="field">
        <span>Additional notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={() => void handleDispatch()} disabled={dispatching}>
        {dispatching ? "Dispatching…" : "Dispatch to agent"}
      </button>
    </section>
  );
}
