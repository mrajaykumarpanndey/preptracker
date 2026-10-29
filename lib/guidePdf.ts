import PDFDocument from "pdfkit";
import type { Guide } from "./guide";

// Renders a study guide as a simple A4 PDF using PDFKit's built-in fonts (no font files needed).

const ACCENT = "#2a63d6";
const ACCENT_SOFT = "#eef3fd";
const TEXT = "#2b2f36";
const MUTED = "#7a808a";
const CODE_BG = "#f3f5f8";
const GOOD_SOFT = "#e9f6ee";
const BAD = "#c53030";

const M = 50; // page margin
const W = 595.28 - M * 2; // content width on A4

/** The built-in PDF fonts only cover Latin-1, so map common typography to plain ASCII. */
function ascii(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[→⇒➜]/g, "->")
    .replace(/[←⇐]/g, "<-")
    .replace(/…/g, "...")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[≠]/g, "!=")
    .replace(/[×]/g, "x")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "");
}

export function renderGuidePdf(guide: Guide, meta: { phase?: string }): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Title: `Study guide: ${guide.topic}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const bottom = () => doc.page.height - M - 20;
  const ensure = (height: number) => {
    if (doc.y + height > bottom()) doc.addPage();
  };
  const body = (text: string, opts: { color?: string; size?: number; font?: string; indent?: number } = {}) => {
    doc
      .font(opts.font ?? "Helvetica")
      .fontSize(opts.size ?? 10.5)
      .fillColor(opts.color ?? TEXT)
      .text(ascii(text), M + (opts.indent ?? 0), doc.y, { width: W - (opts.indent ?? 0), lineGap: 2.5 });
  };
  const section = (title: string, firstBlockHeight = 40) => {
    ensure(28 + firstBlockHeight);
    doc.moveDown(0.9);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(title.toUpperCase(), M, doc.y, { characterSpacing: 1.2 });
    doc.moveDown(0.45);
  };
  const box = (text: string, fill: string, stripe: string) => {
    doc.font("Helvetica").fontSize(10.5);
    const h = doc.heightOfString(ascii(text), { width: W - 28, lineGap: 2.5 }) + 20;
    ensure(h);
    const y = doc.y;
    doc.roundedRect(M, y, W, h, 6).fill(fill);
    doc.rect(M, y, 3.5, h).fill(stripe);
    doc.fillColor(TEXT).text(ascii(text), M + 16, y + 10, { width: W - 28, lineGap: 2.5 });
    doc.y = y + h;
  };

  // Header
  doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text("PREP TRACKER  ·  STUDY GUIDE", M, M, { characterSpacing: 1.2 });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#1f2430").text(ascii(guide.topic), { width: W });
  const sub = [guide.category, meta.phase].filter(Boolean).join("  ·  ");
  if (sub) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(ascii(sub));
  doc.moveDown(0.5);
  doc.rect(M, doc.y, 48, 3).fill(ACCENT);
  doc.moveDown(1.1);

  box(guide.summary, ACCENT_SOFT, ACCENT);
  doc.moveDown(0.6);
  body(`Why interviewers ask: ${guide.whyItMatters}`, { color: MUTED, size: 10 });

  // Key ideas
  section("Key ideas");
  guide.keyPoints.forEach((point, i) => {
    doc.font("Helvetica").fontSize(10.5);
    const h = doc.heightOfString(ascii(point.explanation), { width: W - 26, lineGap: 2.5 }) + 18;
    ensure(h);
    const y = doc.y;
    doc.circle(M + 8, y + 7, 8).fill(ACCENT);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff").text(String(i + 1), M, y + 3, { width: 16, align: "center" });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text(ascii(point.title), M + 26, y, { width: W - 26 });
    doc.font("Helvetica").fontSize(10.5).fillColor(TEXT).text(ascii(point.explanation), M + 26, doc.y + 1, { width: W - 26, lineGap: 2.5 });
    doc.moveDown(0.6);
  });

  // Diagram: numbered boxes joined by arrows, up to three per row.
  if (guide.diagram && guide.diagram.steps.length) {
    const steps = guide.diagram.steps.slice(0, 6);
    const perRow = steps.length <= 4 ? steps.length : 3;
    const gap = 26;
    const bw = (W - gap * (perRow - 1)) / perRow;
    doc.font("Helvetica-Bold").fontSize(10);
    const bh = Math.max(...steps.map((s, i) => doc.heightOfString(`${i + 1}. ${ascii(s)}`, { width: bw - 16 }))) + 22;
    const rows = Math.ceil(steps.length / perRow);
    section(`Diagram: ${guide.diagram.title}`, rows * (bh + 14) + 30);
    let y = doc.y + 4;
    steps.forEach((step, i) => {
      const col = i % perRow;
      if (i > 0 && col === 0) y += bh + 14;
      const x = M + col * (bw + gap);
      doc.roundedRect(x, y, bw, bh, 7).fillAndStroke(ACCENT_SOFT, ACCENT);
      doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(10).text(`${i + 1}. ${ascii(step)}`, x + 8, y + 11, { width: bw - 16, align: "center" });
      if (col < perRow - 1 && i < steps.length - 1) {
        const ax = x + bw + 4;
        const ay = y + bh / 2;
        doc.moveTo(ax, ay).lineTo(ax + gap - 10, ay).lineWidth(1.5).stroke(ACCENT);
        doc.polygon([ax + gap - 8, ay], [ax + gap - 14, ay - 4], [ax + gap - 14, ay + 4]).fill(ACCENT);
      }
    });
    doc.y = y + bh + 8;
    body(guide.diagram.caption, { color: MUTED, size: 9.5 });
  }

  // Code
  if (guide.code) {
    const code = ascii(guide.code.snippet).replace(/\t/g, "  ");
    doc.font("Courier").fontSize(9);
    const h = doc.heightOfString(code, { width: W - 24, lineGap: 1.5 }) + 20;
    section(`Example (${guide.code.language})`, h + 30);
    const y = doc.y;
    doc.roundedRect(M, y, W, h, 6).fill(CODE_BG);
    doc.fillColor("#1f2430").font("Courier").fontSize(9).text(code, M + 12, y + 10, { width: W - 24, lineGap: 1.5 });
    doc.y = y + h + 6;
    body(guide.code.explanation, { color: MUTED, size: 9.5 });
  }

  // In real ML work
  section("In real ML work");
  body(guide.inPractice);

  // Build it yourself
  {
    const b = guide.buildIt;
    section(`Build it yourself: ${b.title}`, 90);
    body(b.goal, { font: "Helvetica-Bold" });
    doc.moveDown(0.3);
    b.steps.forEach((step, i) => {
      doc.font("Helvetica").fontSize(10.5);
      ensure(doc.heightOfString(ascii(step), { width: W - 22 }) + 6);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(ACCENT).text(`${i + 1}.`, M + 2, y);
      doc.font("Helvetica").fontSize(10.5).fillColor(TEXT).text(ascii(step), M + 22, y, { width: W - 22, lineGap: 2.5 });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.3);
    body(`Use: ${b.resources}`, { color: MUTED, size: 10 });
    body(`You should see: ${b.expected}`, { color: MUTED, size: 10 });
    body(`Stretch: ${b.stretch}`, { color: MUTED, size: 10 });
  }

  // Common mistakes
  section("Common mistakes");
  guide.pitfalls.forEach((pitfall) => {
    doc.font("Helvetica").fontSize(10.5);
    ensure(doc.heightOfString(ascii(pitfall), { width: W - 16 }) + 6);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(BAD).text("x", M + 2, y);
    doc.font("Helvetica").fontSize(10.5).fillColor(TEXT).text(ascii(pitfall), M + 16, y, { width: W - 16, lineGap: 2.5 });
    doc.moveDown(0.35);
  });

  // Interview questions
  section("Questions you may be asked");
  guide.interviewQuestions.forEach((qa) => {
    doc.font("Helvetica").fontSize(10.5);
    ensure(doc.heightOfString(ascii(qa.answer), { width: W - 16 }) + 30);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(TEXT).text(`Q. ${ascii(qa.question)}`, M, doc.y, { width: W });
    doc.moveDown(0.15);
    body(qa.answer, { indent: 16, color: "#4a505a" });
    doc.moveDown(0.55);
  });

  // Recap
  section("Quick recap", 60);
  box(guide.recap.map((r) => `-  ${r}`).join("\n"), GOOD_SOFT, "#1f8a4c");

  // Footer with page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing inside the bottom margin would otherwise start a new page
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Prep Tracker  ·  ${ascii(guide.topic)}  ·  page ${i + 1} of ${range.count}`, M, doc.page.height - M + 4, {
        width: W,
        align: "center",
        lineBreak: false,
      });
  }

  doc.end();
  return done;
}
