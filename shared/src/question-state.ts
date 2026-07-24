import { QUESTION_MARKER } from "./constants.js";
import type { QuestionState, WorkItemComment } from "./types.js";

/**
 * Deterministic heuristic over oldest-first comments: finds the LAST comment
 * whose text starts with QUESTION_MARKER. Questions are considered open when
 * no later comment exists that does NOT start with the marker (i.e. nobody
 * has replied to the most recent question yet).
 */
export function detectQuestionState(comments: WorkItemComment[]): QuestionState {
  let lastQuestionIndex = -1;

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    if (comment && comment.text.startsWith(QUESTION_MARKER)) {
      lastQuestionIndex = i;
    }
  }

  if (lastQuestionIndex === -1) {
    return { hasOpenQuestions: false, lastQuestionCommentId: null };
  }

  const lastQuestionComment = comments[lastQuestionIndex];
  const lastQuestionCommentId = lastQuestionComment ? lastQuestionComment.id : null;

  let hasLaterNonMarkerComment = false;
  for (let i = lastQuestionIndex + 1; i < comments.length; i++) {
    const comment = comments[i];
    if (comment && !comment.text.startsWith(QUESTION_MARKER)) {
      hasLaterNonMarkerComment = true;
      break;
    }
  }

  return {
    hasOpenQuestions: !hasLaterNonMarkerComment,
    lastQuestionCommentId,
  };
}
