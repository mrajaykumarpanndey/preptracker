"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Guide, GuideContent } from "@/lib/guide";

type Props = { row: number; guide: Guide };

/**
 * Text that becomes editable in place when editing. Uncontrolled while focused (contentEditable),
 * committed on blur, so typing never fights React re-renders.
 */
function E({
  value,
  onChange,
  editing,
  as: Tag = "span",
  className,
  multiline = true,
}: {
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  as?: "span" | "p" | "b" | "h2" | "div";
  className?: string;
  multiline?: boolean;
}) {
  if (!editing) return <Tag className={className}>{value}</Tag>;
  return (
    <Tag
      className={`${className ?? ""} editable`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onBlur={(e) => onChange((e.currentTarget as HTMLElement).innerText.trim())}
    >
      {value}
    </Tag>
  );
}

/** A list whose items can be added and removed while editing. */
function EList<T>({
  items,
  onChange,
  editing,
  blank,
  addLabel,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  editing: boolean;
  blank: T;
  addLabel: string;
  render: (item: T, update: (next: T) => void, index: number) => ReactNode;
}) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className={editing ? "edit-item" : undefined}>
          {render(item, (next) => onChange(items.map((it, j) => (j === i ? next : it))), i)}
          {editing && (
            <button type="button" className="remove-item" title="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              &times;
            </button>
          )}
        </div>
      ))}
      {editing && (
        <button type="button" className="add-item" onClick={() => onChange([...items, structuredClone(blank)])}>
          + {addLabel}
        </button>
      )}
    </>
  );
}

const contentOf = (g: Guide): GuideContent => ({
  summary: g.summary,
  whyItMatters: g.whyItMatters,
  keyPoints: g.keyPoints,
  diagram: g.diagram,
  code: g.code,
  inPractice: g.inPractice,
  buildIt: g.buildIt,
  pitfalls: g.pitfalls,
  interviewQuestions: g.interviewQuestions,
  recap: g.recap,
});

export default function GuideDocument({ row, guide }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [doc, setDoc] = useState<GuideContent>(() => contentOf(guide));
  const latest = useRef(doc); // always the newest edits, even before React re-renders
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0); // remounts editable fields after cancel/reset

  const set = <K extends keyof GuideContent>(key: K, value: GuideContent[K]) => {
    latest.current = { ...latest.current, [key]: value };
    setDoc(latest.current);
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    (document.activeElement as HTMLElement | null)?.blur(); // commit the field being edited
    setBusy(true);
    setStatus("Saving…");
    const res = await fetch(`/api/guide/${row}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(latest.current),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Couldn't save");
      return;
    }
    setDirty(false);
    setEditing(false);
    setStatus("Saved - the PDF now uses your version.");
    router.refresh();
  }

  function cancel() {
    latest.current = contentOf(guide);
    setDoc(latest.current);
    setDirty(false);
    setEditing(false);
    setStatus("");
    setVersion((v) => v + 1);
  }

  async function rewrite() {
    if (!confirm("Rewrite this guide from scratch with AI? Your edits to it will be lost.")) return;
    setBusy(true);
    setStatus("Rewriting… this takes about 30 seconds.");
    const res = await fetch(`/api/guide/${row}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setStatus("Couldn't rewrite the guide. Try again.");
      return;
    }
    setStatus("Rewritten.");
    window.location.reload();
  }

  const ed = editing;
  return (
    <div key={version} className={editing ? "guide-editing" : undefined}>
      <div className="guide-toolbar">
        <div className="guide-actions" style={{ margin: 0 }}>
          {!editing ? (
            <>
              <a href={`/api/guide/${row}`} className="button-link" target="_blank" rel="noreferrer">
                Download PDF
              </a>
              <Link href={`/quiz/${row}`} className="button-link secondary-link">
                Take the quiz
              </Link>
              <button type="button" className="secondary" onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={save} disabled={busy}>
                Save
              </button>
              <button type="button" className="secondary" onClick={cancel} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="secondary danger" onClick={rewrite} disabled={busy}>
                Rewrite with AI
              </button>
            </>
          )}
        </div>
        <span className="muted small">
          {status || (editing ? "Click any text to change it." : guide.editedAt ? "Edited by you" : "")}
        </span>
      </div>

      <E as="p" className="guide-summary" value={doc.summary} editing={ed} onChange={(v) => set("summary", v)} />
      <p className="muted">
        <b>Why interviewers ask:</b> <E value={doc.whyItMatters} editing={ed} onChange={(v) => set("whyItMatters", v)} />
      </p>

      <h2>Key ideas</h2>
      <div className="guide-points">
        <EList
          items={doc.keyPoints}
          editing={ed}
          blank={{ title: "New idea", explanation: "Explain it in two or three short sentences." }}
          addLabel="Add key idea"
          onChange={(v) => set("keyPoints", v)}
          render={(p, update, i) => (
            <div className="point">
              <span className="point-num">{i + 1}</span>
              <div>
                <E as="b" value={p.title} editing={ed} multiline={false} onChange={(title) => update({ ...p, title })} />
                <E as="div" className="muted" value={p.explanation} editing={ed} onChange={(explanation) => update({ ...p, explanation })} />
              </div>
            </div>
          )}
        />
      </div>

      {doc.diagram && (
        <>
          <div className="section-row">
            <E as="h2" value={doc.diagram.title} editing={ed} multiline={false} onChange={(title) => set("diagram", { ...doc.diagram!, title })} />
            {ed && (
              <button type="button" className="link-button danger-text" onClick={() => set("diagram", null)}>
                Remove diagram
              </button>
            )}
          </div>
          <div
            className="flow"
            role="img"
            aria-label={doc.diagram.steps.join(", then ")}
            style={{ gridTemplateColumns: `repeat(${doc.diagram.steps.length <= 4 ? Math.max(doc.diagram.steps.length, 1) : 3}, 1fr)` }}
          >
            {doc.diagram.steps.map((step, i, all) => (
              <div key={i} className={`flow-step ${i === all.length - 1 || (all.length > 4 && i % 3 === 2) ? "row-end" : ""}`}>
                <span className="flow-num">{i + 1}</span>
                <E
                  value={step}
                  editing={ed}
                  multiline={false}
                  onChange={(v) => set("diagram", { ...doc.diagram!, steps: all.map((s, j) => (j === i ? v : s)) })}
                />
                {ed && (
                  <button
                    type="button"
                    className="remove-item"
                    title="Remove step"
                    onClick={() => set("diagram", { ...doc.diagram!, steps: all.filter((_, j) => j !== i) })}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {ed && doc.diagram.steps.length < 6 && (
            <button type="button" className="add-item" onClick={() => set("diagram", { ...doc.diagram!, steps: [...doc.diagram!.steps, "New step"] })}>
              + Add step
            </button>
          )}
          <E as="p" className="muted small" value={doc.diagram.caption} editing={ed} onChange={(caption) => set("diagram", { ...doc.diagram!, caption })} />
        </>
      )}

      {doc.code && (
        <>
          <div className="section-row">
            <h2>Example ({doc.code.language})</h2>
            {ed && (
              <button type="button" className="link-button danger-text" onClick={() => set("code", null)}>
                Remove example
              </button>
            )}
          </div>
          {ed ? (
            <textarea
              className="code-editor"
              defaultValue={doc.code.snippet}
              spellCheck={false}
              rows={Math.min(24, doc.code.snippet.split("\n").length + 1)}
              onBlur={(e) => set("code", { ...doc.code!, snippet: e.currentTarget.value })}
            />
          ) : (
            <pre className="guide-code">
              <code>{doc.code.snippet}</code>
            </pre>
          )}
          <E as="p" className="muted small" value={doc.code.explanation} editing={ed} onChange={(explanation) => set("code", { ...doc.code!, explanation })} />
        </>
      )}

      <h2>In real ML work</h2>
      <E as="p" value={doc.inPractice} editing={ed} onChange={(v) => set("inPractice", v)} />

      <section className="build">
        <p className="eyebrow">Build it yourself</p>
        <E as="h2" value={doc.buildIt.title} editing={ed} multiline={false} onChange={(title) => set("buildIt", { ...doc.buildIt, title })} />
        <p>
          <E as="b" value={doc.buildIt.goal} editing={ed} onChange={(goal) => set("buildIt", { ...doc.buildIt, goal })} />
        </p>
        <div className="numbered">
          <EList
            items={doc.buildIt.steps}
            editing={ed}
            blank="New step"
            addLabel="Add step"
            onChange={(steps) => set("buildIt", { ...doc.buildIt, steps })}
            render={(s, update, i) => (
              <div className="numbered-item">
                <span>{i + 1}.</span>
                <E value={s} editing={ed} onChange={update} />
              </div>
            )}
          />
        </div>
        <dl>
          <dt>Use</dt>
          <E as="div" value={doc.buildIt.resources} editing={ed} onChange={(resources) => set("buildIt", { ...doc.buildIt, resources })} />
          <dt>You should see</dt>
          <E as="div" value={doc.buildIt.expected} editing={ed} onChange={(expected) => set("buildIt", { ...doc.buildIt, expected })} />
          <dt>Stretch</dt>
          <E as="div" value={doc.buildIt.stretch} editing={ed} onChange={(stretch) => set("buildIt", { ...doc.buildIt, stretch })} />
        </dl>
      </section>

      <h2>Common mistakes</h2>
      <div className="guide-pitfalls">
        <EList
          items={doc.pitfalls}
          editing={ed}
          blank="Describe a common mistake."
          addLabel="Add mistake"
          onChange={(v) => set("pitfalls", v)}
          render={(p, update) => (
            <div className="pitfall">
              <span aria-hidden>✕</span>
              <E value={p} editing={ed} onChange={update} />
            </div>
          )}
        />
      </div>

      <h2>Questions you may be asked</h2>
      <div className="guide-qa">
        <EList
          items={doc.interviewQuestions}
          editing={ed}
          blank={{ question: "New question?", answer: "A short model answer." }}
          addLabel="Add question"
          onChange={(v) => set("interviewQuestions", v)}
          render={(qa, update) =>
            ed ? (
              <div className="qa-edit">
                <E as="b" value={qa.question} editing multiline={false} onChange={(question) => update({ ...qa, question })} />
                <E as="p" value={qa.answer} editing onChange={(answer) => update({ ...qa, answer })} />
              </div>
            ) : (
              <details>
                <summary>{qa.question}</summary>
                <p>{qa.answer}</p>
              </details>
            )
          }
        />
      </div>

      <h2>Quick recap</h2>
      <div className="guide-recap">
        <EList
          items={doc.recap}
          editing={ed}
          blank="One-line takeaway."
          addLabel="Add takeaway"
          onChange={(v) => set("recap", v)}
          render={(r, update) => (
            <div className="recap-item">
              <span aria-hidden>•</span>
              <E value={r} editing={ed} onChange={update} />
            </div>
          )}
        />
      </div>

      {!editing && (
        <div className="guide-actions" style={{ marginTop: 28 }}>
          <Link href={`/quiz/${row}`} className="button-link">
            I&apos;ve read it - take the quiz
          </Link>
        </div>
      )}
    </div>
  );
}
