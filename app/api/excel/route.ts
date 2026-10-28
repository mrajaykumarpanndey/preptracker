import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { excelExists, excelPath } from "@/lib/excel";

export const dynamic = "force-dynamic";

// Download the current tracker workbook (protected by the site password like every page).
export function GET() {
  if (!excelExists()) return NextResponse.json({ error: "No Excel file on the server" }, { status: 404 });
  return new NextResponse(new Uint8Array(readFileSync(excelPath())), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${path.basename(excelPath())}"`,
      "Cache-Control": "no-store",
    },
  });
}
