import type { ReactNode } from "react";

// Hand-rolled SVG/HTML charts. Colors come from --series-1 / --series-2 (validated for both
// themes); text always uses text tokens. Every mark has a native hover tooltip via <title>.

const W = 960;
const H = 280;
const PAD = { top: 18, right: 92, bottom: 32, left: 44 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthYear = (d: Date) => `${monthName.format(d)} '${String(d.getUTCFullYear()).slice(2)}`;
const asDate = (day: string) => new Date(`${day.slice(0, 10)}T12:00:00Z`);

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  table?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`card chart-card ${wide ? "wide" : ""}`}>
      <header className="chart-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {legend}
      </header>
      <div className="chart-scroll">{children}</div>
      {table && (
        <details className="chart-table">
          <summary>Show data</summary>
          {table}
        </details>
      )}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; swatch: "s1" | "s2" | "track" | "line-ref" }[] }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className={`swatch ${item.swatch}`} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="chart-empty">{children}</div>;
}

/** Axis maximum and a round step (1, 2, 5 x 10^n) giving about four gridlines. */
function niceScale(value: number): { max: number; step: number } {
  const raw = Math.max(value, 1) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  return { max: Math.ceil(Math.max(value, 1) / step) * step, step };
}

function YGrid({ max, step, format = String }: { max: number; step: number; format?: (v: number) => string }) {
  return (
    <g className="grid">
      {Array.from({ length: Math.round(max / step) + 1 }, (_, i) => {
        const value = step * i;
        const y = PAD.top + plotH - (value / max) * plotH;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} />
            <text x={PAD.left - 8} y={y} dy="0.32em" textAnchor="end">
              {format(value)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Progress by phase (stacked horizontal bars) ---------- */

export type PhaseStat = { code: string; name?: string; total: number; done: number; active: number };

export function PhaseProgress({ phases }: { phases: PhaseStat[] }) {
  return (
    <div className="phase-list">
      {phases.map((p) => {
        const pct = (n: number) => `${(n / Math.max(p.total, 1)) * 100}%`;
        const label = `${p.code}: ${p.done} done, ${p.active} in progress, ${p.total - p.done - p.active} not started`;
        return (
          <div key={p.code} className="phase-row">
            <div className="phase-label">
              <b>{p.code}</b>
              <span className="muted small">{p.name ?? "Not scheduled (0 weeks)"}</span>
            </div>
            <div className="phase-bar" role="img" aria-label={label} title={label}>
              {p.done > 0 && <div className="seg s1" style={{ width: pct(p.done) }} />}
              {p.active > 0 && <div className="seg s2" style={{ width: pct(p.active) }} />}
            </div>
            <div className="phase-value">
              {p.done}/{p.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Plan vs actual (burn-up lines) ---------- */

export type BurnPoint = { day: string; planned: number; done: number | null };

export function BurnUp({ points, today }: { points: BurnPoint[]; today: string }) {
  const { max, step: yStep } = niceScale(Math.max(...points.map((p) => Math.max(p.planned, p.done ?? 0))));
  const t0 = asDate(points[0].day).getTime();
  const t1 = asDate(points[points.length - 1].day).getTime();
  const x = (day: string) => PAD.left + ((asDate(day).getTime() - t0) / Math.max(t1 - t0, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const path = (values: { day: string; v: number }[]) =>
    values.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join("");

  const planned = points.map((p) => ({ day: p.day, v: p.planned }));
  const done = points.filter((p) => p.done !== null).map((p) => ({ day: p.day, v: p.done! }));
  const lastPlanned = planned[planned.length - 1];
  const lastDone = done[done.length - 1];
  const showToday = today >= points[0].day && today <= points[points.length - 1].day;

  // One x tick per month.
  const months: string[] = [];
  for (const p of points) {
    const key = p.day.slice(0, 7);
    if (!months.includes(key)) months.push(key);
  }
  const step = Math.ceil(months.length / 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Topics planned versus completed over time">
      <YGrid max={max} step={yStep} />
      <g className="axis">
        {months.map((m, i) =>
          i % step === 0 ? (
            <text key={m} x={x(`${m}-01` < points[0].day ? points[0].day : `${m}-01`)} y={H - 8} textAnchor="middle">
              {monthYear(asDate(`${m}-01`))}
            </text>
          ) : null,
        )}
      </g>
      {showToday && (
        <g className="ref">
          <line x1={x(today)} x2={x(today)} y1={PAD.top} y2={PAD.top + plotH} />
          <text x={x(today) + 4} y={PAD.top + 10}>
            Today
          </text>
        </g>
      )}
      <path d={path(planned)} className="line s1" />
      {done.length > 1 && <path d={path(done)} className="line s2" />}
      {lastDone && <circle cx={x(lastDone.day)} cy={y(lastDone.v)} r={4.5} className="dot s2" />}
      <text className="end-label" x={x(lastPlanned.day) + 8} y={y(lastPlanned.v)} dy="0.32em">
        Plan {lastPlanned.v}
      </text>
      {lastDone && (
        <text className="end-label" x={x(lastDone.day) + 8} y={y(lastDone.v)} dy="0.32em">
          Done {lastDone.v}
        </text>
      )}
      {/* Hover targets: one column per sample, wider than the marks. */}
      {points.map((p, i) => {
        const left = i === 0 ? PAD.left : (x(points[i - 1].day) + x(p.day)) / 2;
        const right = i === points.length - 1 ? PAD.left + plotW : (x(p.day) + x(points[i + 1].day)) / 2;
        return (
          <rect key={p.day} x={left} y={PAD.top} width={Math.max(right - left, 1)} height={plotH} className="hit">
            <title>
              {`${shortDate.format(asDate(p.day))}: planned ${p.planned}${p.done === null ? "" : `, done ${p.done}`}`}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

/* ---------- Interview scores over time ---------- */

export type ScorePoint = { date: string; topic: string; score: number };

export function ScoreTimeline({ points, passScore }: { points: ScorePoint[]; passScore: number }) {
  const n = points.length;
  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / 10) * plotH;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join("");
  const labelEvery = Math.ceil(n / 8);
  // Periodic labels, plus the last one unless it would collide with its neighbour.
  const showLabel = (i: number) => i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2 + 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Interview scores in order taken">
      <YGrid max={10} step={2} />
      <g className="ref">
        <line x1={PAD.left} x2={PAD.left + plotW} y1={y(passScore)} y2={y(passScore)} />
        <text x={PAD.left + plotW + 6} y={y(passScore)} dy="0.32em">
          Pass {passScore}
        </text>
      </g>
      {n > 1 && <path d={line} className="line s1 thin" />}
      <g className="axis">
        {points.map((p, i) =>
          showLabel(i) ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle">
              {shortDate.format(asDate(p.date))}
            </text>
          ) : null,
        )}
      </g>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r={5} className="dot s1" />
          <circle cx={x(i)} cy={y(p.score)} r={14} className="hit">
            <title>{`${p.topic} - ${p.score}/10 (${shortDate.format(asDate(p.date))})`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Average score by category (horizontal bars) ---------- */

export function CategoryScores({ items }: { items: { category: string; avg: number; count: number }[] }) {
  return (
    <div className="bar-list">
      {items.map((item) => {
        const label = `${item.category}: average ${item.avg.toFixed(1)}/10 over ${item.count} topic${item.count === 1 ? "" : "s"}`;
        return (
          <div key={item.category} className="bar-row" title={label}>
            <div className="bar-label">{item.category}</div>
            <div className="bar-track" role="img" aria-label={label}>
              <div className="bar-fill s1" style={{ width: `${Math.max(item.avg * 10, 1.5)}%` }} />
            </div>
            <div className="bar-value">{item.avg.toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Weekly study hours (columns) ---------- */

export function WeeklyHours({ weeks }: { weeks: { weekStart: string; hours: number }[] }) {
  const { max, step: yStep } = niceScale(Math.max(...weeks.map((w) => w.hours)));
  const slot = plotW / weeks.length;
  const barW = Math.min(36, slot - 4);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(weeks.length / 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Study hours per week">
      <YGrid max={max} step={yStep} format={(v) => `${v}h`} />
      {weeks.map((w, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        const top = y(w.hours);
        const r = Math.min(4, barW / 2, (PAD.top + plotH - top) / 2);
        // Rounded data-end, square at the baseline.
        const d = `M${cx - barW / 2},${PAD.top + plotH}V${top + r}q0,-${r} ${r},-${r}H${cx + barW / 2 - r}q${r},0 ${r},${r}V${PAD.top + plotH}Z`;
        return (
          <g key={w.weekStart}>
            <path d={d} className="fill s1" />
            {weeks.length <= 12 && (
              <text x={cx} y={top - 6} textAnchor="middle" className="value-label">
                {w.hours}
              </text>
            )}
            {(i === weeks.length - 1 || (i % labelEvery === 0 && weeks.length - 1 - i >= labelEvery / 2 + 0.5)) && (
              <text x={cx} y={H - 8} textAnchor="middle" className="axis-text">
                {shortDate.format(asDate(w.weekStart))}
              </text>
            )}
            <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH} className="hit">
              <title>{`Week of ${shortDate.format(asDate(w.weekStart))}: ${w.hours} hours`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
