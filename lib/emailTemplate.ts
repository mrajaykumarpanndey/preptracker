import { config } from "./config";

// One layout for every email: light background, centred 600px white card, header, heading,
// body sections, a single call-to-action button, sign-off and footer. Table-based with inline styles
// so it renders the same in Gmail, Outlook and phone mail apps.

const FONT = "Helvetica,Arial,sans-serif";
const TEXT = "#3b3b3b";
const MUTED = "#8a8f98";
const ACCENT = "#2a63d6";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A paragraph in the template's body style. `html` must already be escaped. */
export const p = (html: string) =>
  `<p style="margin:0 0 14px;line-height:175%;font-family:${FONT};font-size:16px;color:${TEXT}">${html}</p>`;

export const heading = (text: string) =>
  `<p style="margin:22px 0 8px;font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${MUTED}">${esc(text)}</p>`;

export const list = (itemsHtml: string[]) =>
  `<ul style="margin:0 0 14px;padding-left:22px;line-height:175%;font-family:${FONT};font-size:16px;color:${TEXT}">${itemsHtml
    .map((i) => `<li style="margin-bottom:4px">${i}</li>`)
    .join("")}</ul>`;

/** Horizontal progress bar (tables only, so it survives every mail client). */
export function progressBar(done: number, total: number): string {
  const pct = Math.round((done / Math.max(total, 1)) * 100);
  const width = Math.max(pct, 1);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr>
<td width="${width}%" style="background:${ACCENT};height:10px;border-radius:5px 0 0 5px;font-size:0;line-height:0">&nbsp;</td>
<td style="background:#e6e9ef;height:10px;border-radius:0 5px 5px 0;font-size:0;line-height:0">&nbsp;</td>
</tr></table>
<p style="margin:0 0 14px;font-family:${FONT};font-size:13px;color:${MUTED}">${done} of ${total} topics done (${pct}%)</p>`;
}

/** Rows of "time | colour bar | title + subtitle" - used for the day's timetable. */
export function schedule(rows: { time: string; color: string; title: string; subtitle: string; href?: string }[]): string {
  const cells = rows
    .map(
      (r) => `<tr>
<td valign="top" style="padding:9px 12px 9px 0;white-space:nowrap;font-family:${FONT};font-size:14px;color:${MUTED}">${esc(r.time)}</td>
<td valign="top" style="padding:9px 0 9px 12px;border-left:4px solid ${r.color};font-family:${FONT};font-size:15px;color:${TEXT}">
<b>${r.href ? `<a href="${r.href}" style="color:${TEXT};text-decoration:none">${esc(r.title)}</a>` : esc(r.title)}</b><br>
<span style="font-size:13px;color:${r.color}">${esc(r.subtitle)}</span></td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-collapse:collapse">${cells}</table>`;
}

export function renderEmail(opts: {
  preheader: string; // inbox preview text
  title: string;
  body: string; // HTML built from the helpers above
  cta?: { label: string; url: string };
  ctaColor?: string;
}): string {
  const button = opts.cta
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:8px auto 18px;border-collapse:separate"><tr>
<td align="center" bgcolor="${opts.ctaColor ?? ACCENT}" style="border-radius:8px;background:${opts.ctaColor ?? ACCENT}">
<a href="${opts.cta.url}" target="_blank" style="display:block;padding:13px 26px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(opts.cta.label)}</a>
</td></tr></table>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#fafafa">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fafafa" style="background:#fafafa;min-width:320px"><tr><td align="center" style="padding:24px 10px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td align="right" style="padding:0 4px 10px;font-family:${FONT};font-size:12px">
      <a href="${config.appUrl}" target="_blank" style="color:${MUTED};text-decoration:none">Open Prep Tracker</a>
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:12px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:22px 28px 0;font-family:${FONT}">
          <span style="font-size:20px;font-weight:bold;color:${ACCENT};letter-spacing:-0.3px">Prep&nbsp;Tracker</span>
          <span style="font-size:13px;color:${MUTED}">&nbsp;&nbsp;·&nbsp; placement prep, one day at a time</span>
        </td></tr>
        <tr><td style="padding:6px 28px 0"><div style="height:3px;width:56px;background:${ACCENT};border-radius:2px;font-size:0;line-height:0">&nbsp;</div></td></tr>
        <tr><td style="padding:20px 28px 4px;font-family:${FONT};font-size:24px;line-height:130%;font-weight:bold;color:#1f2430">${esc(opts.title)}</td></tr>
        <tr><td style="padding:12px 28px 4px">${opts.body}${button}</td></tr>
        <tr><td style="padding:0 28px 24px">
          ${p("Keep going,<br>Your Prep Tracker")}
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:16px 20px;font-family:${FONT};font-size:12px;line-height:160%;color:${MUTED}">
      You're receiving this because reminders are on in Prep Tracker.<br>
      <a href="${config.appUrl}/settings" target="_blank" style="color:${MUTED};text-decoration:underline">Settings</a>
      &nbsp;·&nbsp;
      <a href="${config.appUrl}/insights" target="_blank" style="color:${MUTED};text-decoration:underline">Your progress</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
