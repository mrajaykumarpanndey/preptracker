"use server";

import { revalidatePath } from "next/cache";
import { STATUS } from "@/lib/constants";
import { getRow, updateRow } from "@/lib/store";

const ALLOWED: string[] = Object.values(STATUS);

export async function setTopicStatus(row: number, status: string): Promise<{ error?: string }> {
  if (!ALLOWED.includes(status)) return { error: "Unknown status" };
  if (!(await getRow(row))) return { error: "Topic not found" };
  try {
    await updateRow(row, { status });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  revalidatePath("/");
  revalidatePath("/insights");
  return {};
}
