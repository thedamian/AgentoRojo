import { useState } from "react";

interface Props {
  text: string;
}

/** Copy-to-clipboard button used for setup file contents. */
export default function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="copy-button" onClick={() => void handleCopy()}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
