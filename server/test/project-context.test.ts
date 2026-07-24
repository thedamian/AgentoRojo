import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/index.js";

describe("project context routes", () => {
  it("404s when absent, then round-trips with timestamps after PUT", async () => {
    const db = openDb(":memory:");
    const app = createApp({ db });

    const before = await request(app).get("/api/projects/octo/my-app");
    expect(before.status).toBe(404);
    expect(before.body.code).toBe("NOT_FOUND");

    const put = await request(app)
      .put("/api/projects/octo/my-app")
      .send({ purpose: "Purpose text", usersDescription: "Users text" });

    expect(put.status).toBe(200);
    expect(put.body.githubRepo).toBe("octo/my-app");
    expect(put.body.purpose).toBe("Purpose text");
    expect(put.body.usersDescription).toBe("Users text");
    expect(typeof put.body.createdAt).toBe("string");
    expect(typeof put.body.updatedAt).toBe("string");

    const after = await request(app).get("/api/projects/octo/my-app");
    expect(after.status).toBe(200);
    expect(after.body).toEqual(put.body);
  });

  it("lists all project contexts", async () => {
    const db = openDb(":memory:");
    const app = createApp({ db });

    await request(app).put("/api/projects/octo/one").send({ purpose: "p1", usersDescription: "u1" });
    await request(app).put("/api/projects/octo/two").send({ purpose: "p2", usersDescription: "u2" });

    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { githubRepo: string }) => p.githubRepo).sort()).toEqual(["octo/one", "octo/two"]);
  });
});
