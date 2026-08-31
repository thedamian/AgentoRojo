import { useEffect, useState, type FormEvent } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import type { ProjectContext } from "@agento-rojo/shared";
import { clearGithubPat, getGithubPat, setGithubPat } from "../auth/githubPat";
import { getAccount, isEntraConfigured, signIn, signOut } from "../auth/msal";
import { friendlyMessage, getSettings, listProjects, putSettings } from "../api/client";
import ProjectContextRow from "../components/ProjectContextRow";
import { getConnectionProfile } from "../auth/connectionProfile";

interface Props {
  notice?: string;
  onConfigure: () => void;
}

export default function SettingsScreen({ notice, onConfigure }: Props) {
  const [pat, setPat] = useState(getGithubPat() ?? "");
  const [patSaved, setPatSaved] = useState(Boolean(getGithubPat()));
  const [account, setAccount] = useState<AccountInfo | null>(null);

  const [dodFieldName, setDodFieldName] = useState("");
  const [dodLoading, setDodLoading] = useState(true);
  const [dodSaving, setDodSaving] = useState(false);
  const [dodError, setDodError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectContext[] | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const profile = getConnectionProfile();

  useEffect(() => {
    void getAccount().then(setAccount);
    getSettings()
      .then((s) => setDodFieldName(s.dodFieldName))
      .catch((err: unknown) => setDodError(friendlyMessage(err)))
      .finally(() => setDodLoading(false));
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => setProjectsError(friendlyMessage(err)));
  }, []);

  function savePat() {
    setGithubPat(pat.trim());
    setPatSaved(true);
  }
  function clearPat() {
    clearGithubPat();
    setPat("");
    setPatSaved(false);
  }

  async function saveDod(e: FormEvent) {
    e.preventDefault();
    setDodSaving(true);
    setDodError(null);
    try {
      const s = await putSettings({ dodFieldName });
      setDodFieldName(s.dodFieldName);
    } catch (err) {
      setDodError(friendlyMessage(err));
    } finally {
      setDodSaving(false);
    }
  }

  async function handleSignIn() {
    await signIn();
    setAccount(await getAccount());
  }
  async function handleSignOut() {
    await signOut();
    setAccount(await getAccount());
  }

  return (
    <section className="step">
      <h1>Settings</h1>
      {notice && <p className="notice">{notice}</p>}

      <fieldset>
        <legend>Connection profile</legend>
        {profile ? (
          <p>
            {profile.storyBoard === "jira" ? "Jira" : "Azure DevOps"} · {profile.executionTarget === "local" ? "Local agent" : profile.executionTarget === "claude" ? "Claude" : "OpenAI"} · {profile.gitProvider === "azure-devops" ? "Azure DevOps Git" : profile.gitProvider}
          </p>
        ) : <p>No connection profile has been saved.</p>}
        <button type="button" onClick={onConfigure}>Change connections</button>
      </fieldset>

      <fieldset>
        <legend>GitHub PAT</legend>
        <label className="field">
          <span>Fine-grained personal access token</span>
          <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} autoComplete="off" />
        </label>
        <div className="actions">
          <button type="button" onClick={savePat} disabled={!pat.trim()}>
            Save
          </button>
          <button type="button" className="secondary" onClick={clearPat} disabled={!patSaved}>
            Clear
          </button>
        </div>
        {patSaved && <p className="ok">A GitHub PAT is saved in this browser.</p>}
        <p>Required fine-grained permissions:</p>
        <ul>
          <li>Contents — Read and write (required for repository_dispatch)</li>
          <li>Actions — Read</li>
          <li>Metadata — Read</li>
          <li>Variables — Read (used by the repo readiness check)</li>
        </ul>
      </fieldset>

      <fieldset>
        <legend>Azure DevOps sign-in (Entra ID)</legend>
        {!isEntraConfigured() ? (
          <p className="notice">
            Entra ID is not configured — set VITE_ENTRA_CLIENT_ID in web/.env to enable Azure DevOps sign-in.
          </p>
        ) : account ? (
          <div>
            <p>Signed in as {account.username}</p>
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => void handleSignIn()}>
            Sign in
          </button>
        )}
      </fieldset>

      <fieldset>
        <legend>Definition of Done field</legend>
        {dodLoading ? (
          <p>Loading…</p>
        ) : (
          <form onSubmit={(e) => void saveDod(e)}>
            <label className="field">
              <span>Definition of Done field reference name</span>
              <input type="text" value={dodFieldName} onChange={(e) => setDodFieldName(e.target.value)} required />
            </label>
            <p className="hint">Default: Custom.DefinitionOfDone</p>
            {dodError && (
              <p className="error" role="alert">
                {dodError}
              </p>
            )}
            <button type="submit" disabled={dodSaving}>
              {dodSaving ? "Saving…" : "Save"}
            </button>
          </form>
        )}
      </fieldset>

      <fieldset>
        <legend>Project contexts</legend>
        {projectsError && (
          <p className="error" role="alert">
            {projectsError}
          </p>
        )}
        {projects === null && !projectsError && <p>Loading…</p>}
        {projects && projects.length === 0 && <p>No project contexts saved yet.</p>}
        {projects?.map((p) => (
          <ProjectContextRow
            key={p.githubRepo}
            project={p}
            expanded={expandedRepo === p.githubRepo}
            onToggle={() => setExpandedRepo(expandedRepo === p.githubRepo ? null : p.githubRepo)}
            onSaved={(updated) =>
              setProjects((prev) => prev?.map((x) => (x.githubRepo === updated.githubRepo ? updated : x)) ?? prev)
            }
          />
        ))}
      </fieldset>
    </section>
  );
}
