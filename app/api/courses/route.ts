import { NextResponse } from "next/server";
import { listCourses } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const courses = await listCourses();
    return NextResponse.json({
      courses,
      feedConfigured: Boolean(process.env.BRIGHTSPACE_ICS_URL),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
