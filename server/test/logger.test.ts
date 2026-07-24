import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ADO_TOKEN_HEADER, GITHUB_TOKEN_HEADER } from "@agento-rojo/shared";
import { createRequestLogger, redactHeaders } from "../src/middleware/logger.js";

describe("redactHeaders", () => {
  it("replaces the ADO and GitHub token header values with [REDACTED]", () => {
    const result = redactHeaders({
      [ADO_TOKEN_HEADER]: "secret-ado-token",
      [GITHUB_TOKEN_HEADER]: "secret-github-token",
      "content-type": "application/json",
    });

    expect(result[ADO_TOKEN_HEADER]).toBe("[REDACTED]");
    expect(result[GITHUB_TOKEN_HEADER]).toBe("[REDACTED]");
    expect(result["content-type"]).toBe("application/json");
  });
});

describe("request logger", () => {
  it("never lets token values reach the log sink", async () => {
    const sink = vi.fn();
    const app = express();
    app.use(createRequestLogger(sink));
    app.get("/ping", (_req, res) => {
      res.status(200).send("ok");
    });

    const adoToken = "super-secret-ado-token";
    const githubToken = "super-secret-github-token";

    await request(app).get("/ping").set(ADO_TOKEN_HEADER, adoToken).set(GITHUB_TOKEN_HEADER, githubToken);

    expect(sink).toHaveBeenCalledTimes(1);
    const loggedMessage = sink.mock.calls[0]?.[0] as string;

    expect(loggedMessage).not.toContain(adoToken);
    expect(loggedMessage).not.toContain(githubToken);
    expect(loggedMessage).toContain("[REDACTED]");
    expect(loggedMessage).toContain("GET");
    expect(loggedMessage).toContain("/ping");
    expect(loggedMessage).toContain("200");
  });

  it("logs the full mounted path even for a route that ends the response without calling next()", async () => {
    const sink = vi.fn();
    const app = express();
    app.use(createRequestLogger(sink));
    const router = express.Router();
    router.get("/ping", (_req, res) => {
      res.status(200).send("ok");
    });
    app.use("/api", router);

    await request(app).get("/api/ping");

    expect(sink).toHaveBeenCalledTimes(1);
    const loggedMessage = sink.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain('"path":"/api/ping"');
  });
});
