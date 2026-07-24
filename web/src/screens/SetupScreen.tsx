import { useEffect, useState } from "react";
import type { AgentSetupFile } from "@agento-rojo/shared";
import { friendlyMessage, getAgentSetupFiles } from "../api/client";
import CopyButton from "../components/CopyButton";

/** Renders the agent-setup/ template files for the user to copy into a target repo. */
export default function SetupScreen() {
  const [files, setFiles] = useState<AgentSetupFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAgentSetupFiles()
      .then(setFiles)
      .catch((err: unknown) => setError(friendlyMessage(err)));
  }, []);

  return (
    <section className="step">
      <h1>Setup files</h1>
      <p>
        Copy these files into the target GitHub repository at the paths shown below. No secrets need to be
        added to the target repo — only the non-secret Actions variables checked by the readiness step.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!files && !error && <p>Loading…</p>}
      {files?.map((f) => (
        <div key={f.name} className="setup-file">
          <h2>
            {f.name} <span className="hint">→ {f.targetPath}</span>
          </h2>
          <pre>{f.content}</pre>
          <CopyButton text={f.content} />
        </div>
      ))}
    </section>
  );
}
