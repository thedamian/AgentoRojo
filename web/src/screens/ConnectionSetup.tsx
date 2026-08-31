import { useState, type FormEvent } from "react";
import { type ConnectionProfile, type ExecutionTarget, type GitProvider, type LocalCodingAgent, type StoryBoard, saveConnectionProfile } from "../auth/connectionProfile";

interface Props { initialProfile: ConnectionProfile | null; onComplete: (profile: ConnectionProfile) => void; }

const storyBoardOptions: Array<{ value: StoryBoard; label: string; detail: string }> = [
  { value: "azure-devops", label: "Azure DevOps", detail: "Azure Boards work items, stories, features, and comments." },
  { value: "jira", label: "Jira", detail: "Jira stories, epics, attachments, and discussion." },
];
const executionOptions: Array<{ value: ExecutionTarget; label: string; detail: string }> = [
  { value: "local", label: "Local", detail: "Run a coding agent on this laptop through the local backend." },
  { value: "claude", label: "Claude", detail: "Use Anthropic-managed Claude for planning and implementation." },
  { value: "openai", label: "OpenAI", detail: "Use OpenAI-managed agents for planning and implementation." },
];
const gitOptions: Array<{ value: GitProvider; label: string; detail: string }> = [
  { value: "github", label: "GitHub", detail: "Create one pull request per story on GitHub." },
  { value: "gitlab", label: "GitLab", detail: "Create one merge request per story on GitLab." },
  { value: "azure-devops", label: "Azure DevOps Git", detail: "Create one pull request per story in Azure Repos." },
];

function ChoiceGroup<T extends string>({ legend, options, value, onChange }: { legend: string; options: Array<{ value: T; label: string; detail: string }>; value: T; onChange: (value: T) => void }) {
  return <fieldset className="choice-group"><legend>{legend}</legend><div className="choice-grid">{options.map((option) => (
    <label className={`choice-card ${value === option.value ? "selected" : ""}`} key={option.value}>
      <input type="radio" name={legend} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span><strong>{option.label}</strong><small>{option.detail}</small></span>
    </label>
  ))}</div></fieldset>;
}

/** First-run, browser-local connection wizard. It collects exactly one choice per capability. */
export default function ConnectionSetup({ initialProfile, onComplete }: Props) {
  const existing = initialProfile;
  const [stage, setStage] = useState<"choices" | "credentials">(existing?.credentialsComplete ? "credentials" : "choices");
  const [storyBoard, setStoryBoard] = useState<StoryBoard>(existing?.storyBoard ?? "azure-devops");
  const [executionTarget, setExecutionTarget] = useState<ExecutionTarget>(existing?.executionTarget ?? "local");
  const [localCodingAgent, setLocalCodingAgent] = useState<LocalCodingAgent>(existing?.localCodingAgent ?? "codex");
  const [gitProvider, setGitProvider] = useState<GitProvider>(existing?.gitProvider ?? "github");
  const [boardCredential, setBoardCredential] = useState(existing?.boardCredential ?? "");
  const [gitCredential, setGitCredential] = useState(existing?.gitCredential ?? "");
  const [modelCredential, setModelCredential] = useState(existing?.modelCredential ?? "");
  function profile(credentialsComplete: boolean): ConnectionProfile { return { version: 1, storyBoard, executionTarget, localCodingAgent: executionTarget === "local" ? localCodingAgent : undefined, gitProvider, credentialsComplete, boardCredential: boardCredential.trim() || undefined, gitCredential: gitCredential.trim() || undefined, modelCredential: modelCredential.trim() || undefined, lastStoryUrl: existing?.lastStoryUrl }; }
  function saveChoices(e: FormEvent) { e.preventDefault(); saveConnectionProfile(profile(false)); setStage("credentials"); }
  function saveCredentials(e: FormEvent) { e.preventDefault(); const saved = profile(true); saveConnectionProfile(saved); onComplete(saved); }
  if (stage === "choices") return <section className="onboarding step">
    <p className="eyebrow">Welcome to Agento Rojo</p><h1>A Coding Agent with Context and Communication skills</h1>
    <p className="lead">Connect your story board, coding environment, and repository once. Agento Rojo will use that context when it reads a story, clarifies gaps with the team, and prepares a single pull request.</p>
    <form onSubmit={saveChoices}>
      <ChoiceGroup legend="Which story board will you use?" options={storyBoardOptions} value={storyBoard} onChange={setStoryBoard} />
      <ChoiceGroup legend="Where should the coding work run?" options={executionOptions} value={executionTarget} onChange={setExecutionTarget} />
      {executionTarget === "local" && <fieldset><legend>Local coding agent</legend><label className="field"><span>Agent installed on this laptop</span><select value={localCodingAgent} onChange={(e) => setLocalCodingAgent(e.target.value as LocalCodingAgent)}><option value="codex">Codex</option><option value="claude-code">Claude Code</option><option value="other">Another compatible CLI agent</option></select></label></fieldset>}
      <ChoiceGroup legend="Which Git repository provider do you prefer?" options={gitOptions} value={gitProvider} onChange={setGitProvider} />
      <button type="submit">Continue to connections</button>
    </form></section>;
  const boardName = storyBoard === "jira" ? "Jira" : "Azure DevOps";
  const gitName = gitProvider === "azure-devops" ? "Azure DevOps Git" : gitProvider === "gitlab" ? "GitLab" : "GitHub";
  const credentialsReady = Boolean(boardCredential.trim() && gitCredential.trim() && (executionTarget === "local" || modelCredential.trim()));
  return <section className="onboarding step"><p className="eyebrow">Step 2 of 2</p><h1>Connect your services</h1>
    <p className="lead">These credentials stay in this browser and are sent only to the selected service when a story is processed. You can replace or remove them later in Settings.</p>
    <form onSubmit={saveCredentials}>
      <fieldset><legend>{boardName} access</legend><label className="field"><span>{storyBoard === "jira" ? "Jira API token or personal access token" : "Azure DevOps personal access token (or use Entra sign-in in Settings)"}</span><input type="password" value={boardCredential} onChange={(e) => setBoardCredential(e.target.value)} autoComplete="off" /></label></fieldset>
      <fieldset><legend>{gitName} access</legend><label className="field"><span>Personal access token</span><input type="password" value={gitCredential} onChange={(e) => setGitCredential(e.target.value)} autoComplete="off" /></label>{gitProvider === "github" && <p className="hint">GitHub: Contents read/write, Pull requests read/write, Actions read, and Metadata read.</p>}</fieldset>
      {executionTarget !== "local" && <fieldset><legend>{executionTarget === "claude" ? "Anthropic" : "OpenAI"} access</legend><label className="field"><span>API key</span><input type="password" value={modelCredential} onChange={(e) => setModelCredential(e.target.value)} autoComplete="off" /></label></fieldset>}
      <p className="hint">All selected services need a credential before Agento Rojo can begin work. Credentials are stored only in this browser.</p><div className="actions"><button type="button" className="secondary" onClick={() => setStage("choices")}>Back</button><button type="submit" disabled={!credentialsReady}>Save connections</button></div>
    </form></section>;
}
