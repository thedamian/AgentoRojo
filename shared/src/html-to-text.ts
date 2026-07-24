const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (match) => ENTITY_MAP[match] ?? match);
}

/**
 * Converts ADO HTML field values (Description, Acceptance Criteria, DoD, etc.)
 * into readable plain text / markdown-ish text:
 *   <br>            -> newline
 *   <p>, <div>       -> paragraph/line breaks
 *   <li>             -> "- " prefixed lines
 * All other tags are stripped. Common HTML entities are decoded. Runs of 3+
 * newlines collapse to 2. Result is trimmed. null/undefined input yields "".
 */
export function htmlToText(html: string | null | undefined): string {
  if (html === null || html === undefined) {
    return "";
  }

  let text = html;

  // Line breaks.
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // List items -> "- " prefixed lines.
  text = text.replace(/<li[^>]*>/gi, "- ");
  text = text.replace(/<\/li>/gi, "\n");

  // Paragraph / div boundaries -> newlines.
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<div[^>]*>/gi, "");

  // Strip any remaining tags.
  text = text.replace(/<[^>]+>/g, "");

  // Decode common entities.
  text = decodeEntities(text);

  // Collapse excessive blank lines and trim.
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}
