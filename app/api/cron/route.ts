import { NextResponse, type NextRequest } from "next/server";
import { runScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// Called by Vercel Cron (sends "Authorization: Bearer $CRON_SECRET"),
// cron-job.org, or `npm run local-cron`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runScheduler());
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
