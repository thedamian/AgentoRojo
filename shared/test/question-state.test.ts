import { describe, expect, it } from "vitest";
import { QUESTION_MARKER } from "../src/constants.js";
import { detectQuestionState } from "../src/question-state.js";
import type { WorkItemComment } from "../src/types.js";

function comment(id: number, text: string): WorkItemComment {
  return { id, author: "someone", createdDate: "2026-01-01T00:00:00Z", text };
}

describe("detectQuestionState", () => {
  it("returns closed with no comments", () => {
    expect(detectQuestionState([])).toEqual({ hasOpenQuestions: false, lastQuestionCommentId: null });
  });

  it("returns closed when there is no marker comment", () => {
    const comments = [comment(1, "hello"), comment(2, "world")];
    expect(detectQuestionState(comments)).toEqual({ hasOpenQuestions: false, lastQuestionCommentId: null });
  });

  it("is open when the marker comment is last", () => {
    const comments = [comment(1, "hello"), comment(2, `${QUESTION_MARKER} what about X?`)];
    expect(detectQuestionState(comments)).toEqual({ hasOpenQuestions: true, lastQuestionCommentId: 2 });
  });

  it("is closed when a marker comment is followed by a normal comment", () => {
    const comments = [comment(1, `${QUESTION_MARKER} what about X?`), comment(2, "here is the answer")];
    expect(detectQuestionState(comments)).toEqual({ hasOpenQuestions: false, lastQuestionCommentId: 1 });
  });

  it("is open when only the first of two marker comments was answered", () => {
    const comments = [
      comment(1, `${QUESTION_MARKER} first question?`),
      comment(2, "answer to first"),
      comment(3, `${QUESTION_MARKER} second question?`),
    ];
    expect(detectQuestionState(comments)).toEqual({ hasOpenQuestions: true, lastQuestionCommentId: 3 });
  });
});
