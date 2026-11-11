import { NextResponse } from "next/server";
import { createAssignment } from "@/lib/notion";
import type { PlannerItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { courseId, items } = (await req.json()) as { courseId: string; items: PlannerItem[] };
  if (!courseId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Nothing to send." }, { status: 400 });
  }
  const created: string[] = [];
  const failed: { name: string; error: string }[] = [];
  // Notion allows about 3 requests a second, so go one at a time
  for (const item of items) {
    try {
      await createAssignment(item, courseId);
      created.push(item.name);
    } catch (err) {
      failed.push({ name: item.name, error: (err as Error).message });
    }
  }
  return NextResponse.json({ created, failed });
}
