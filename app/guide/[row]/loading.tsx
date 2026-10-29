export default function Loading() {
  return (
    <div className="guide">
      <p className="eyebrow">Study guide</p>
      <h1>Writing your study guide…</h1>
      <p className="muted">The first time you open a topic this takes up to a minute. After that it opens instantly.</p>
      <div className="guide-skeleton" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
