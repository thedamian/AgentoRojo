import { useEffect, useState } from "react";
import { validateRepo, friendlyMessage } from "../api/client";

const REPO_PATTERN = /^[^/\s]+\/[^/\s]+$/;

interface Props {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  label?: string;
  id?: string;
}

/** Text field for "owner/repo" with live validation against GET /api/github/validate-repo. */
export default function RepoInput({ value, onChange, onValidChange, label = "GitHub repo (owner/repo)", id }: Props) {
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setStatus("idle");
      setMessage(null);
      onValidChange?.(false);
      return;
    }
    if (!REPO_PATTERN.test(trimmed)) {
      setStatus("invalid");
      setMessage("Expected format: owner/repo");
      onValidChange?.(false);
      return;
    }

    setStatus("checking");
    const handle = setTimeout(() => {
      validateRepo(trimmed)
        .then((result) => {
          setStatus(result.valid ? "valid" : "invalid");
          setMessage(
            result.valid
              ? result.defaultBranch
                ? `Default branch: ${result.defaultBranch}`
                : null
              : (result.message ?? "Repository not found."),
          );
          onValidChange?.(result.valid);
        })
        .catch((err: unknown) => {
          setStatus("invalid");
          setMessage(friendlyMessage(err));
          onValidChange?.(false);
        });
      // eslint: onValidChange intentionally omitted from deps below to avoid re-triggering
      // the debounce on every parent render.
    }, 500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className="field repo-input">
      <span>{label}</span>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="owner/repo" />
      {status === "checking" && <span className="hint">Checking…</span>}
      {status === "valid" && <span className="ok">✓ {message ?? "Repository found."}</span>}
      {status === "invalid" && <span className="error">✗ {message}</span>}
    </label>
  );
}
