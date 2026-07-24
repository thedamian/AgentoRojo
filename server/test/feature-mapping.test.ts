import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/index.js";

describe("feature mapping routes", () => {
  it("404s when unmapped, then round-trips after PUT", async () => {
    const db = openDb(":memory:");
    const app = createApp({ db });

    const before = await request(app).get("/api/features/my-org/My-Project/55");
    expect(before.status).toBe(404);
    expect(before.body.code).toBe("NOT_FOUND");

    const mapping = {
      adoFeatureId: 55,
      adoOrg: "my-org",
      adoProject: "My-Project",
      featureTitle: "Feature 55",
      githubRepo: "octo/my-app",
    };

    const put = await request(app).put("/api/features/55").send(mapping);
    expect(put.status).toBe(200);
    expect(put.body).toEqual(mapping);

    const after = await request(app).get("/api/features/my-org/My-Project/55");
    expect(after.status).toBe(200);
    expect(after.body).toEqual(mapping);
  });

  it("rejects a githubRepo not in owner/repo format", async () => {
    const db = openDb(":memory:");
    const app = createApp({ db });

    const res = await request(app).put("/api/features/7").send({
      adoOrg: "org",
      adoProject: "proj",
      featureTitle: "Feature 7",
      githubRepo: "not-a-valid-repo",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
  });
});
