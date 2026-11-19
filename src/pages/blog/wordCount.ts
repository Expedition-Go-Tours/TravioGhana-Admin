/**
 * Words in a TipTap document, counted from its text nodes only.
 *
 * The sidebar used to stringify the whole JSON and strip punctuation, which
 * counted `type`, `doc`, `paragraph`, `attrs` … as words — "Hello world"
 * reported 29. Only `text` nodes are prose; everything else is structure.
 */
interface TextNode {
  text?: string;
  content?: TextNode[];
}

function count(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function countWords(body: unknown): number {
  if (typeof body === "string") return count(body);
  if (!body || typeof body !== "object") return 0;

  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const current = node as TextNode;
    if (typeof current.text === "string") parts.push(current.text);
    if (Array.isArray(current.content)) current.content.forEach(walk);
  };

  walk(body);
  return count(parts.join(" "));
}
