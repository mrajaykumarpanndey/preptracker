import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { setPlanWindow } from "@/lib/excel";
import { dataSource } from "@/lib/store";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Re-plan the roadmap to run from `start` to `end` (YYYY-MM-DD). Protected by the site password.
export async function POST(req: Request) {
  if (dataSource() !== "excel") return NextResponse.json({ error: "Only supported for the Excel tracker" }, { status: 400 });
  const { start, end } = (await req.json()) as { start?: string; end?: string };
  if (!start || !end || !DAY.test(start) || !DAY.test(end) || end < start) {
    return NextResponse.json({ error: "Send start and end as YYYY-MM-DD, with end on or after start" }, { status: 400 });
  }
  try {
    const phases = await setPlanWindow(start, end);
    revalidatePath("/");
    revalidatePath("/insights");
    return NextResponse.json({ phases });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
