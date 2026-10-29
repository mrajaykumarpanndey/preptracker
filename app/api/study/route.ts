import { NextResponse } from "next/server";
import { getRow, recordStudy } from "@/lib/store";
import { formatLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

// Heartbeat from the study guide page: one row per reading session, updated as you read.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    session?: string;
    row?: number;
    startedAt?: number;
    focusedSeconds?: number;
    readPercent?: number;
  } | null;
  if (!body?.session || !/^[\w-]{6,40}$/.test(body.session) || typeof body.row !== "number") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const row = await getRow(body.row);
  if (!row) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const minutes = Math.round((Math.max(0, Number(body.focusedSeconds) || 0) / 60) * 10) / 10;
  if (minutes === 0) return NextResponse.json({ ok: true, skipped: "no focused time yet" });
  await recordStudy({
    session: body.session,
    started: formatLocal(new Date(Number(body.startedAt) || Date.now())),
    topic: row.topic,
    activity: "Reading",
    minutes,
    readPercent: Math.max(0, Math.min(100, Math.round(Number(body.readPercent) || 0))),
  });
  return NextResponse.json({ ok: true });
}
