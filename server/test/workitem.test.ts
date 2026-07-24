import { describe, expect, it } from "vitest";
import request from "supertest";
import { ADO_TOKEN_HEADER } from "@agento-rojo/shared";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/index.js";
import type { AdoClient, AdoRelation, AdoWorkItem } from "../src/clients/ado.js";
import { createMockAdoClient } from "./mocks.js";

const CHILD_ID = 123;
const PARENT_ID = 99;
const WORK_ITEM_URL = "https://dev.azure.com/org/proj/_workitems/edit/123";

function buildAdoClient(): AdoClient {
  const childFields: Record<string, unknown> = {
    "System.Title": "Do the thing",
    "System.Description": "<p>Do it well</p>",
    "Microsoft.VSTS.Common.AcceptanceCriteria": "<ul><li>AC1</li><li>AC2</li></ul>",
    "System.WorkItemType": "User Story",
    "Custom.DefinitionOfDone": "<p>Done when tested</p>",
  };
  const parentFields: Record<string, unknown> = {
    "System.Title": "Parent feature",
    "System.WorkItemType": "Feature",
  };
  const relations: AdoRelation[] = [
    { rel: "System.LinkTypes.Hierarchy-Reverse", url: `https://dev.azure.com/org/_apis/wit/workItems/${PARENT_ID}` },
  ];

  return createMockAdoClient({
    getWorkItem: async (_org, _project, id): Promise<AdoWorkItem> => {
      if (id === CHILD_ID) {
        return { id, fields: childFields, relations };
      }
      if (id === PARENT_ID) {
        return { id, fields: parentFields };
      }
      throw new Error(`unexpected work item id ${id}`);
    },
    getComments: async () => [
      { id: 1, text: "hello there", createdBy: { displayName: "Alice" }, createdDate: "2026-01-01T00:00:00Z" },
    ],
  });
}

describe("GET /api/workitem", () => {
  it("returns a fully-assembled WorkItemDetails", async () => {
    const db = openDb(":memory:");
    const app = createApp({ db, createAdoClient: () => buildAdoClient() });

    const res = await request(app)
      .get(`/api/workitem?url=${encodeURIComponent(WORK_ITEM_URL)}`)
      .set(ADO_TOKEN_HEADER, "fake-ado-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: CHILD_ID,
      org: "org",
      project: "proj",
      url: WORK_ITEM_URL,
      title: "Do the thing",
      description: "Do it well",
      acceptanceCriteria: "- AC1\n- AC2",
      definitionOfDone: "Done when tested",
      dodFieldMissing: false,
      workItemType: "User Story",
      parentFeature: { id: PARENT_ID, title: "Parent feature" },
    });
    expect(res.body.comments).toEqual([
      { id: 1, author: "Alice", createdDate: "2026-01-01T00:00:00Z", text: "hello there" },
    ]);
  });

  it("reports dodFieldMissing when the configured DoD field is absent", async () => {
    const adoClient = createMockAdoClient({
      getWorkItem: async (_org, _project, id): Promise<AdoWorkItem> => ({
        id,
        fields: {
          "System.Title": "No DoD here",
          "System.WorkItemType": "User Story",
        },
      }),
      getComments: async () => [],
    });

    const db = openDb(":memory:");
    const app = createApp({ db, createAdoClient: () => adoClient });

    const res = await request(app)
      .get(`/api/workitem?url=${encodeURIComponent(WORK_ITEM_URL)}`)
      .set(ADO_TOKEN_HEADER, "fake-ado-token");

    expect(res.status).toBe(200);
    expect(res.body.definitionOfDone).toBeNull();
    expect(res.body.dodFieldMissing).toBe(true);
    expect(res.body.parentFeature).toBeNull();
  });

  it("returns 400 BAD_REQUEST for an unparseable url", async () => {
    const db = openDb(":memory:");
    const app = createApp({ db, createAdoClient: () => createMockAdoClient() });

    const res = await request(app).get("/api/workitem?url=not-a-url").set(ADO_TOKEN_HEADER, "fake-ado-token");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
  });
});
