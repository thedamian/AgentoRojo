import { describe, expect, it } from "vitest";
import { MAX_PAYLOAD_BYTES } from "../src/constants.js";
import { truncateDispatchPayload } from "../src/payload.js";
import type { DispatchPayload, WorkItemComment } from "../src/types.js";

function byteSize(payload: DispatchPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

function basePayload(comments: WorkItemComment[]): DispatchPayload {
  return {
    workItemId: 42,
    workItemUrl: "https://dev.azure.com/org/proj/_workitems/edit/42",
    adoOrg: "org",
    adoProject: "proj",
    title: "Some title",
    description: "Some description",
    acceptanceCriteria: "Some AC",
    definitionOfDone: "Some DoD",
    comments,
    projectPurpose: "purpose",
    projectUsers: "users",
    additionalNotes: "notes",
  };
}

function bigComment(id: number): WorkItemComment {
  return {
    id,
    author: "someone",
    createdDate: "2026-01-01T00:00:00Z",
    text: "x".repeat(5000),
  };
}

describe("truncateDispatchPayload", () => {
  it("leaves a small payload unchanged and does not set commentsTruncated", () => {
    const payload = basePayload([{ id: 1, author: "a", createdDate: "2026-01-01T00:00:00Z", text: "short" }]);
    const result = truncateDispatchPayload(payload);
    expect(result).toEqual(payload);
    expect("commentsTruncated" in result).toBe(false);
  });

  it("drops oldest comments first until the payload fits, setting commentsTruncated", () => {
    const comments = Array.from({ length: 20 }, (_, i) => bigComment(i + 1));
    const payload = basePayload(comments);
    expect(byteSize(payload)).toBeGreaterThan(MAX_PAYLOAD_BYTES);

    const result = truncateDispatchPayload(payload);

    expect(result.commentsTruncated).toBe(true);
    expect(byteSize(result)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    // Oldest comments (lowest ids) are dropped first, newest survive.
    expect(result.comments.length).toBeLessThan(comments.length);
    expect(result.comments[result.comments.length - 1]?.id).toBe(20);
    expect(result.comments.map((c) => c.id)).toEqual(
      comments.slice(comments.length - result.comments.length).map((c) => c.id),
    );
  });

  it("does not mutate the input payload", () => {
    const comments = Array.from({ length: 20 }, (_, i) => bigComment(i + 1));
    const payload = basePayload(comments);
    const originalCommentsLength = payload.comments.length;
    const snapshot = JSON.stringify(payload);

    truncateDispatchPayload(payload);

    expect(payload.comments.length).toBe(originalCommentsLength);
    expect("commentsTruncated" in payload).toBe(false);
    expect(JSON.stringify(payload)).toBe(snapshot);
  });

  it("returns the payload without throwing when still oversized with zero comments", () => {
    const payload = basePayload([]);
    payload.description = "y".repeat(MAX_PAYLOAD_BYTES + 1000);

    expect(() => truncateDispatchPayload(payload)).not.toThrow();
    const result = truncateDispatchPayload(payload);
    expect(result.comments).toEqual([]);
    expect(byteSize(result)).toBeGreaterThan(MAX_PAYLOAD_BYTES);
  });
});
