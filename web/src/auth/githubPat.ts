/** GitHub fine-grained PAT storage. Stored in localStorage only — never sent anywhere except
 * as the x-github-token request header, and never logged. */

const STORAGE_KEY = "agento-rojo.github-pat";

export function getGithubPat(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setGithubPat(pat: string): void {
  localStorage.setItem(STORAGE_KEY, pat);
}

export function clearGithubPat(): void {
  localStorage.removeItem(STORAGE_KEY);
}
