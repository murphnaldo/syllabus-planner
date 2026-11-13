import { NextResponse } from "next/server";
import { listAssignmentsForCourse, listCourses } from "@/lib/notion";
import { fetchFeed, filterForCourse } from "@/lib/ics";
import { extractItems } from "@/lib/extract";
import { findDuplicate } from "@/lib/dedupe";
import { getFeedUrl, getSession } from "@/lib/session";
import { guestStatus, outOfRunsMessage, recordGuestRun } from "@/lib/usage";
import type { Course, ExistingAssignment, FeedEvent, PlannerItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const form = await req.formData();
    const semesterStart = String(form.get("semesterStart") ?? "");
    const semesterEnd = String(form.get("semesterEnd") ?? "");
    const useFeed = form.get("useFeed") === "true";
    const feedCourseKey = String(form.get("feedCourseKey") ?? "") || null;
    const extraNotes = String(form.get("notes") ?? "").slice(0, 1000);
    const file = form.get("syllabus");

    if (!isDate(semesterStart) || !isDate(semesterEnd) || semesterEnd < semesterStart) {
      return NextResponse.json({ error: "Enter the semester start and end dates." }, { status: 400 });
    }

    // Friends: check their invite still has runs left before spending AI credits
    if (session.role === "guest") {
      const invite = await guestStatus(session.code);
      if (!invite) return NextResponse.json({ error: "This code is no longer active." }, { status: 401 });
      if (invite.used >= invite.limit) {
        return NextResponse.json({ error: outOfRunsMessage(invite.limit) }, { status: 429 });
      }
    }

    // Which course? Owner picks from Notion; friends type it in
    let course: Course;
    if (session.role === "owner") {
      const courseId = String(form.get("courseId") ?? "");
      const found = (await listCourses()).find((c) => c.id === courseId);
      if (!found) return NextResponse.json({ error: "Pick a course." }, { status: 400 });
      course = found;
    } else {
      const name = String(form.get("courseName") ?? "").trim().slice(0, 120);
      const code = String(form.get("courseCode") ?? "").trim().slice(0, 40);
      if (!name) return NextResponse.json({ error: "Enter the course name." }, { status: 400 });
      course = { id: "", name, code, term: "", meetingTimes: "" };
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

    let feedEvents: FeedEvent[] = [];
    let feedMatchedByCourse = false;
    const warnings: string[] = [];
    if (useFeed) {
      try {
        const url = await getFeedUrl(req, String(form.get("feedUrl") ?? "") || null);
        if (url) {
          const all = await fetchFeed(url);
          const filtered = filterForCourse(all, course, semesterStart, semesterEnd, feedCourseKey);
          feedEvents = filtered.matched;
          feedMatchedByCourse = filtered.matchedByCourse;
        }
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
      session.role === "owner" ? listAssignmentsForCourse(course.id) : Promise.resolve([] as ExistingAssignment[]),
      extractItems({ pdfBase64, course, semesterStart, semesterEnd, feedEvents, feedMatchedByCourse, extraNotes }),
    ]);

    // Count the run only after it succeeded
    let usage: { used: number; limit: number } | null = null;
    if (session.role === "guest") {
      const used = await recordGuestRun(session.code).catch(() => null);
      const invite = await guestStatus(session.code).catch(() => null);
      usage = invite ? { used: used ?? invite.used, limit: invite.limit } : null;
    }

    const items: PlannerItem[] = result.items
      .map((raw, i) => {
        const end = raw.end && raw.end !== raw.start && isDate(raw.end) ? raw.end : null;
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
      usage,
      stats: { feedEvents: feedEvents.length, existing: existing.length, tokens: result.usage },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
