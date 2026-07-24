import { describe, expect, it } from "vitest";
import request from "supertest";
import { ADO_TOKEN_HEADER, GITHUB_TOKEN_HEADER } from "@agento-rojo/shared";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/index.js";
import { UpstreamError } from "../src/clients/upstream-error.js";
import { createMockAdoClient, createMockGitHubClient } from "./mocks.js";

const WORK_ITEM_URL = "https://dev.azure.com/org/proj/_workitems/edit/1";

describe("upstream error mapping", () => {
  it("maps an ADO 401 to 401 ADO_UNAUTHORIZED", async () => {
    const adoClient = createMockAdoClient({
      getWorkItem: async () => {
        throw new UpstreamError("ado", 401, "unauthorized");
      },
    });
    const db = openDb(":memory:");
    const app = createApp({ db, createAdoClient: () => adoClient });

    const res = await request(app)
      .get(`/api/workitem?url=${encodeURIComponent(WORK_ITEM_URL)}`)
      .set(ADO_TOKEN_HEADER, "fake-ado-token");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("ADO_UNAUTHORIZED");
  });

  it("maps a GitHub 401 to 401 GITHUB_UNAUTHORIZED", async () => {
    const githubClient = createMockGitHubClient({
      getRepo: async () => {
        throw new UpstreamError("github", 401, "unauthorized");
      },
    });
    const db = openDb(":memory:");
    const app = createApp({ db, createGitHubClient: () => githubClient });

    const res = await request(app)
      .get("/api/github/validate-repo?repo=octo/my-app")
      .set(GITHUB_TOKEN_HEADER, "fake-pat");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("GITHUB_UNAUTHORIZED");
  });

  it("maps an upstream 429 with Retry-After to 429 RATE_LIMITED", async () => {
    const githubClient = createMockGitHubClient({
      getRepo: async () => {
        throw new UpstreamError("github", 429, "rate limited", 30);
      },
    });
    const db = openDb(":memory:");
    const app = createApp({ db, createGitHubClient: () => githubClient });

    const res = await request(app)
      .get("/api/github/validate-repo?repo=octo/my-app")
      .set(GITHUB_TOKEN_HEADER, "fake-pat");

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("RATE_LIMITED");
    expect(res.body.retryAfterSeconds).toBe(30);
  });

  it("never leaks a stack trace or token in an error body", async () => {
    const adoClient = createMockAdoClient({
      getWorkItem: async () => {
        throw new Error("boom with secret-token-value inside");
      },
    });
    const db = openDb(":memory:");
    const app = createApp({ db, createAdoClient: () => adoClient });

    const res = await request(app)
      .get(`/api/workitem?url=${encodeURIComponent(WORK_ITEM_URL)}`)
      .set(ADO_TOKEN_HEADER, "fake-ado-token");

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
    expect(JSON.stringify(res.body)).not.toContain("secret-token-value");
    expect(JSON.stringify(res.body)).not.toContain("at ");
  });
});
