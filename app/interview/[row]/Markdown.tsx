import { Fragment, type ReactNode } from "react";

// Small renderer for the subset of Markdown the interviewer uses: paragraphs, lists,
// fenced code blocks, `code`, **bold** and *italic*. Builds React nodes, never raw HTML.

function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function withBreaks(text: string): ReactNode[] {
  return text.split("\n").flatMap((line, i) => (i === 0 ? inline(line) : [<br key={`br${i}`} />, ...inline(line)]));
}

function blocks(text: string): ReactNode[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
        return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>)}</ul>;
      }
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}</ol>;
      }
      return <p key={i}>{withBreaks(block)}</p>;
    });
}

export default function Markdown({ text }: { text: string }) {
  const segments = text.split(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g);
  return (
    <div className="md">
      {segments.map((segment, i) =>
        i % 2 === 1 ? (
          <pre key={i}>
            <code>{segment.replace(/\n$/, "")}</code>
          </pre>
        ) : (
          <Fragment key={i}>{blocks(segment)}</Fragment>
        ),
      )}
    </div>
  );
}
