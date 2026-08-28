import type { ReactNode } from "react";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface TipTapAttrs {
  level?: number;
  src?: string;
  alt?: string;
  title?: string;
  href?: string;
}

interface TipTapMark {
  type: string;
  attrs?: TipTapAttrs;
}

export interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: TipTapAttrs;
}

function renderMarks(text: string, marks?: TipTapMark[]): ReactNode {
  if (!marks || marks.length === 0) return text;
  let node: ReactNode = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        node = <strong key={Math.random()}>{node}</strong>;
        break;
      case "italic":
        node = <em key={Math.random()}>{node}</em>;
        break;
      case "underline":
        node = <u key={Math.random()}>{node}</u>;
        break;
      case "strike":
        node = <s key={Math.random()}>{node}</s>;
        break;
      case "code":
        node = <code key={Math.random()} className="rounded bg-surface-muted px-1 py-0.5 text-sm font-mono text-text-primary">{node}</code>;
        break;
      case "link":
        node = (
          <a key={Math.random()} href={mark.attrs?.href as string | undefined} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
            {node}
          </a>
        );
        break;
    }
  }
  return node;
}

export function renderTipTapNode(node: TipTapNode, key?: number): ReactNode {
  const children = node.content?.map((child, i) => renderTipTapNode(child, i));

  switch (node.type) {
    case "doc":
      return <div key={key} className="space-y-4">{children}</div>;

    case "paragraph": {
      const hasText = node.content?.some((n) => n.text);
      if (!hasText) return <div key={key} className="h-4" />;
      return <p key={key} className="text-base leading-relaxed text-text-primary">{children}</p>;
    }

    case "heading": {
      const level = node.attrs?.level || 1;
      const styles = ["text-3xl font-bold", "text-2xl font-semibold", "text-xl font-semibold"];
      const className = `${styles[Math.min(level - 1, 2)]} text-text-primary`;
      if (level === 1) return <h1 key={key} className={className}>{children}</h1>;
      if (level === 2) return <h2 key={key} className={className}>{children}</h2>;
      if (level === 3) return <h3 key={key} className={className}>{children}</h3>;
      return <h4 key={key} className={className}>{children}</h4>;
    }

    case "bulletList":
      return <ul key={key} className="list-disc pl-6 space-y-1 text-text-primary">{children}</ul>;

    case "orderedList":
      return <ol key={key} className="list-decimal pl-6 space-y-1 text-text-primary">{children}</ol>;

    case "listItem":
      return <li key={key}>{children}</li>;

    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-primary/30 pl-4 italic text-text-secondary">
          {children}
        </blockquote>
      );

    case "codeBlock":
      return (
        <pre key={key} className="rounded-lg bg-gray-900 p-4 overflow-x-auto">
          <code className="text-sm text-gray-100 font-mono">{node.content?.[0]?.text || ""}</code>
        </pre>
      );

    case "horizontalRule":
      return <hr key={key} className="border-border-muted" />;

    case "image":
      return (
        <figure key={key} className="my-6 max-w-full">
          <OptimizedImage src={node.attrs?.src} alt={node.attrs?.alt || ""} width={800} className="max-w-full h-auto rounded-sm" fit="fill" />
          {node.attrs?.title && <figcaption className="mt-2 text-center text-sm text-text-tertiary">{node.attrs.title}</figcaption>}
        </figure>
      );

    case "hardBreak":
      return <br key={key} />;

    case "text":
      return renderMarks(node.text || "", node.marks);

    default:
      return children || null;
  }
}

export function renderTipTap(json: TipTapNode | null): ReactNode {
  if (!json) return null;
  return renderTipTapNode(json);
}