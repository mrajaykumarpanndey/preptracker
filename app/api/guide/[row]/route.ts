import { NextResponse } from "next/server";
import { getGuide, regenerateGuide, saveGuide } from "@/lib/guide";
import { renderGuidePdf } from "@/lib/guidePdf";
import { getRow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// The topic's study guide as a PDF download.
export async function GET(_req: Request, { params }: { params: Promise<{ row: string }> }) {
  const row = await getRow(Number((await params).row));
  if (!row) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  try {
    const pdf = await renderGuidePdf(await getGuide(row), { phase: row.phase });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Study guide - ${row.topic.replace(/[^\w ,.-]+/g, "")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Save an edited guide.
export async function PUT(req: Request, { params }: { params: Promise<{ row: string }> }) {
  const row = await getRow(Number((await params).row));
  if (!row) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  try {
    const guide = saveGuide(row, await req.json());
    return NextResponse.json({ ok: true, editedAt: guide.editedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

// Rewrite the guide from scratch with AI (discards edits).
export async function POST(_req: Request, { params }: { params: Promise<{ row: string }> }) {
  const row = await getRow(Number((await params).row));
  if (!row) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  try {
    await regenerateGuide(row);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
