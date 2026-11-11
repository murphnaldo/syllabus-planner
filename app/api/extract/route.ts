import { NextResponse } from "next/server";
import { listAssignmentsForCourse, listCourses } from "@/lib/notion";
import { fetchFeed, filterForCourse } from "@/lib/ics";
import { extractItems } from "@/lib/extract";
import { findDuplicate } from "@/lib/dedupe";
import type { FeedEvent, PlannerItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const courseId = String(form.get("courseId") ?? "");
    const semesterStart = String(form.get("semesterStart") ?? "");
    const semesterEnd = String(form.get("semesterEnd") ?? "");
    const useFeed = form.get("useFeed") === "true";
    const extraNotes = String(form.get("notes") ?? "").slice(0, 1000);
    const file = form.get("syllabus");

    if (!courseId) return NextResponse.json({ error: "Pick a course." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semesterStart) || !/^\d{4}-\d{2}-\d{2}$/.test(semesterEnd)) {
      return NextResponse.json({ error: "Enter the semester start and end dates." }, { status: 400 });
    }

    let pdfBase64: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "The syllabus needs to be a PDF." }, { status: 400 });
      }
      if (file.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: "That PDF is over 4 MB." }, { status: 400 });
      }
      pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    }

    const courses = await listCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course) return NextResponse.json({ error: "Course not found in Notion." }, { status: 404 });

    let feedEvents: FeedEvent[] = [];
    let feedMatchedByCourse = false;
    const warnings: string[] = [];
    if (useFeed && process.env.BRIGHTSPACE_ICS_URL) {
      try {
        const all = await fetchFeed(process.env.BRIGHTSPACE_ICS_URL);
        const filtered = filterForCourse(all, course, semesterStart, semesterEnd);
        feedEvents = filtered.matched;
        feedMatchedByCourse = filtered.matchedByCourse;
      } catch (err) {
        warnings.push(`Could not read the Brightspace feed: ${(err as Error).message}`);
      }
    }

    if (!pdfBase64 && feedEvents.length === 0) {
      return NextResponse.json(
        { error: "Upload a syllabus PDF, or turn on the Brightspace feed." },
        { status: 400 }
      );
    }

    const [existing, result] = await Promise.all([
      listAssignmentsForCourse(courseId),
      extractItems({
        pdfBase64,
        course,
        semesterStart,
        semesterEnd,
        feedEvents,
        feedMatchedByCourse,
        extraNotes,
      }),
    ]);

    const items: PlannerItem[] = result.items
      .map((raw, i) => {
        const end = raw.end && raw.end !== raw.start && /^\d{4}-\d{2}-\d{2}$/.test(raw.end) ? raw.end : null;
        const duplicateOf = findDuplicate(raw.name, raw.start, end, existing);
        return {
          key: `${i}-${raw.start}-${raw.name}`,
          name: raw.name.trim(),
          start: raw.start,
          end,
          kind: raw.kind,
          source: raw.source,
          note: raw.note ?? "",
          duplicateOf,
          include: !duplicateOf,
        };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    return NextResponse.json({
      course,
      items,
      warnings: [...warnings, ...result.warnings],
      stats: {
        feedEvents: feedEvents.length,
        existing: existing.length,
        tokens: result.usage,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
