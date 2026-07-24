import type { AdoClient } from "../src/clients/ado.js";
import type { GitHubClient } from "../src/clients/github.js";

export function createMockAdoClient(overrides: Partial<AdoClient> = {}): AdoClient {
  return {
    getWorkItem: async () => {
      throw new Error("getWorkItem not mocked");
    },
    getComments: async () => [],
    ...overrides,
  };
}

export function createMockGitHubClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getRepo: async () => null,
    fileExists: async () => false,
    listVariableNames: async () => "unknown",
    dispatch: async () => {},
    listWorkflowRuns: async () => [],
    ...overrides,
  };
}
