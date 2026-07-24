import { useState, type FormEvent } from "react";
import type { ProjectContext } from "@agento-rojo/shared";
import { putProject, friendlyMessage } from "../api/client";

interface Props {
  project: ProjectContext;
  expanded: boolean;
  onToggle: () => void;
  onSaved: (project: ProjectContext) => void;
}

/** One expandable row in the Settings "project contexts" admin list. */
export default function ProjectContextRow({ project, expanded, onToggle, onSaved }: Props) {
  const [purpose, setPurpose] = useState(project.purpose);
  const [usersDescription, setUsersDescription] = useState(project.usersDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await putProject(project.githubRepo, { purpose, usersDescription });
      onSaved(updated);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="project-row">
      <button type="button" className="project-row-toggle" onClick={onToggle}>
        {expanded ? "▾" : "▸"} {project.githubRepo}
      </button>
      {expanded && (
        <form onSubmit={(e) => void save(e)}>
          <label className="field">
            <span>Purpose</span>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
          </label>
          <label className="field">
            <span>Main users</span>
            <textarea value={usersDescription} onChange={(e) => setUsersDescription(e.target.value)} required />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}
