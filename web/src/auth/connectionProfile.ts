import { clearGithubPat, getGithubPat, setGithubPat } from "./githubPat";

export type StoryBoard = "azure-devops" | "jira";
export type ExecutionTarget = "local" | "claude" | "openai";
export type LocalCodingAgent = "codex" | "claude-code" | "other";
export type GitProvider = "github" | "gitlab" | "azure-devops";

export interface ConnectionProfile {
  version: 1;
  storyBoard: StoryBoard;
  executionTarget: ExecutionTarget;
  localCodingAgent?: LocalCodingAgent;
  gitProvider: GitProvider;
  credentialsComplete: boolean;
  lastStoryUrl?: string;
  /** Non-GitHub credentials remain browser-local until their server adapters are enabled. */
  boardCredential?: string;
  gitCredential?: string;
  modelCredential?: string;
}

const PROFILE_KEY = "agento-rojo.connection-profile";

export function getConnectionProfile(): ConnectionProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ConnectionProfile>;
    if (
      value.version !== 1 ||
      (value.storyBoard !== "azure-devops" && value.storyBoard !== "jira") ||
      (value.executionTarget !== "local" && value.executionTarget !== "claude" && value.executionTarget !== "openai") ||
      (value.gitProvider !== "github" && value.gitProvider !== "gitlab" && value.gitProvider !== "azure-devops")
    ) return null;
    return value as ConnectionProfile;
  } catch {
    return null;
  }
}

export function saveConnectionProfile(profile: ConnectionProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (profile.gitProvider === "github" && profile.gitCredential?.trim()) setGithubPat(profile.gitCredential.trim());
}

export function clearConnectionProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
  clearGithubPat();
}

export function hasUsableProfile(profile: ConnectionProfile | null): profile is ConnectionProfile {
  return profile !== null && profile.credentialsComplete;
}

export function profileHasGithubCredential(profile: ConnectionProfile): boolean {
  return profile.gitProvider !== "github" || Boolean(profile.gitCredential?.trim() || getGithubPat());
}
