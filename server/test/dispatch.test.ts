import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { DISPATCH_EVENT_TYPE, GITHUB_TOKEN_HEADER, MAX_PAYLOAD_BYTES } from "@agento-rojo/shared";
import type { DispatchPayload, WorkItemComment } from "@agento-rojo/shared";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/index.js";
import type { GitHubClient } from "../src/clients/github.js";
import { createMockGitHubClient } from "./mocks.js";

function basePayload(comments: WorkItemComment[] = []): DispatchPayload {
  return {
    workItemId: 42,
    workItemUrl: "https://dev.azure.com/org/proj/_workitems/edit/42",
    adoOrg: "org",
    adoProject: "proj",
    title: "Title",
    description: "Description",
    acceptanceCriteria: "AC",
    definitionOfDone: "DoD",
    comments,
    projectPurpose: "purpose",
    projectUsers: "users",
    additionalNotes: "notes",
  };
}

describe("POST /api/dispatch", () => {
  it("dispatches to GitHub and records a retrievable audit row", async () => {
    const dispatchSpy = vi.fn<GitHubClient["dispatch"]>(async () => {});
    const githubClient = createMockGitHubClient({ dispatch: dispatchSpy });

    const db = openDb(":memory:");
    const app = createApp({ db, createGitHubClient: () => githubClient });

    const payload = basePayload([{ id: 1, author: "Alice", createdDate: "2026-01-01T00:00:00Z", text: "hi" }]);

    const res = await request(app)
      .post("/api/dispatch")
      .set(GITHUB_TOKEN_HEADER, "fake-pat")
      .send({ githubRepo: "octo/my-app", payload });

    expect(res.status).toBe(200);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(
      "octo",
      "my-app",
      DISPATCH_EVENT_TYPE,
      expect.objectContaining({ workItemId: 42 }),
    );

    const auditRes = await request(app).get("/api/dispatches?workItemId=42");
    expect(auditRes.status).toBe(200);
    expect(auditRes.body).toHaveLength(1);
    expect(auditRes.body[0].githubRepo).toBe("octo/my-app");
    expect(auditRes.body[0].workItemId).toBe(42);
    expect(auditRes.body[0].payload.workItemId).toBe(42);
  });

  it("truncates an oversized comment history before dispatching", async () => {
    const dispatchSpy = vi.fn<GitHubClient["dispatch"]>(async () => {});
    const githubClient = createMockGitHubClient({ dispatch: dispatchSpy });

    const db = openDb(":memory:");
    const app = createApp({ db, createGitHubClient: () => githubClient });

    const comments: WorkItemComment[] = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      author: "Alice",
      createdDate: "2026-01-01T00:00:00Z",
      text: "x".repeat(5000),
    }));
    const payload = basePayload(comments);

    const res = await request(app)
      .post("/api/dispatch")
      .set(GITHUB_TOKEN_HEADER, "fake-pat")
      .send({ githubRepo: "octo/my-app", payload });

    expect(res.status).toBe(200);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    const sentPayload = dispatchSpy.mock.calls[0]?.[3] as DispatchPayload;
    expect(sentPayload.commentsTruncated).toBe(true);
    expect(sentPayload.comments.length).toBeLessThan(comments.length);
    expect(new TextEncoder().encode(JSON.stringify(sentPayload)).length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);

    expect(res.body.payload.commentsTruncated).toBe(true);
  });

  it("rejects a malformed githubRepo", async () => {
    const db = openDb(":memory:");
    const app = createApp({ db, createGitHubClient: () => createMockGitHubClient() });

    const res = await request(app)
      .post("/api/dispatch")
      .set(GITHUB_TOKEN_HEADER, "fake-pat")
      .send({ githubRepo: "not-valid", payload: basePayload() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
  });
});
