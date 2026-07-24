import { describe, expect, it } from "vitest";
import { parseAdoWorkItemUrl } from "../src/ado-url.js";

describe("parseAdoWorkItemUrl", () => {
  it("parses the dev.azure.com format", () => {
    expect(parseAdoWorkItemUrl("https://dev.azure.com/my-org/My-Project/_workitems/edit/123")).toEqual({
      org: "my-org",
      project: "My-Project",
      id: 123,
    });
  });

  it("parses the visualstudio.com format", () => {
    expect(parseAdoWorkItemUrl("https://my-org.visualstudio.com/My-Project/_workitems/edit/456")).toEqual({
      org: "my-org",
      project: "My-Project",
      id: 456,
    });
  });

  it("decodes URL-encoded project names", () => {
    expect(parseAdoWorkItemUrl("https://dev.azure.com/my-org/My%20Project/_workitems/edit/789")).toEqual({
      org: "my-org",
      project: "My Project",
      id: 789,
    });
  });

  it("handles a trailing slash", () => {
    expect(parseAdoWorkItemUrl("https://dev.azure.com/my-org/My-Project/_workitems/edit/123/")).toEqual({
      org: "my-org",
      project: "My-Project",
      id: 123,
    });
  });

  it("handles a query string after the id", () => {
    expect(parseAdoWorkItemUrl("https://dev.azure.com/my-org/My-Project/_workitems/edit/123?fullScreen=true")).toEqual({
      org: "my-org",
      project: "My-Project",
      id: 123,
    });
  });

  it("handles a query string and fragment after the id for visualstudio.com", () => {
    expect(
      parseAdoWorkItemUrl("https://my-org.visualstudio.com/My%20Project/_workitems/edit/456?a=1#section"),
    ).toEqual({
      org: "my-org",
      project: "My Project",
      id: 456,
    });
  });

  it("returns null for unparseable strings", () => {
    expect(parseAdoWorkItemUrl("not a url")).toBeNull();
    expect(parseAdoWorkItemUrl("")).toBeNull();
    expect(parseAdoWorkItemUrl("https://example.com/foo/bar")).toBeNull();
    expect(parseAdoWorkItemUrl("https://dev.azure.com/my-org/My-Project/_workitems/edit/")).toBeNull();
  });

  it("returns null for a non-numeric id", () => {
    expect(parseAdoWorkItemUrl("https://dev.azure.com/my-org/My-Project/_workitems/edit/abc")).toBeNull();
  });
});
