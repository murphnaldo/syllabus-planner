import type { Course, FeedEvent, PlannerItem } from "./types";

const DEFAULT_MODEL = "claude-sonnet-5-5";

export type ExtractInput = {
  pdfBase64: string | null;
  course: Course;
  semesterStart: string; // first day of classes, YYYY-MM-DD
  semesterEnd: string; // last day incl. finals, YYYY-MM-DD
  feedEvents: FeedEvent[];
  feedMatchedByCourse: boolean;
  extraNotes: string;
};

type RawItem = {
  name: string;
  start: string;
  end?: string | null;
  kind: PlannerItem["kind"];
  source: PlannerItem["source"];
  note?: string;
};

const SYSTEM = `You turn a college course syllabus and the student's Brightspace calendar feed into a clean list of planner entries.

Follow the student's rules exactly:
1. COMBINE related items into one entry. Examples: "Midterm 2 Part 1" and "Midterm 2 Part 2" (and any survey tied to that exam) become one entry like "Midterm 2 MCQ and Case Study". Paired pre/post items for the same chapter stay separate only if they have different due dates.
2. SKIP extra credit, optional work, surveys, ungraded warm-ups, practice exams, and anything "not in grade book". Also SKIP in-class attendance or participation check-ins (for example quizzes taken during lecture to record attendance, often named "Week 3 Lecture 1"), since they happen in class and need no planning. Mention once in warnings what kinds of items you skipped.
3. GENERATE rule-based items. If the syllabus states a rule like "homework due at the beginning of class on Mondays for 12 weeks", create one entry per occurrence on the correct dates. Skip university holidays (for Fall: Labor Day, Thanksgiving break; for Spring: MLK Day, spring break) when the syllabus or common sense says no class meets.
4. WEEK-ONLY dates: if an exam or item is only given as "Week N", compute that week from the semester start date (week 1 starts on the start date's week, Monday to Friday). If the exact day is unknown, use a date range covering that class week (start = Monday, end = Friday), and say so in the note.
5. PREFER the Brightspace feed's exact dates when the same item appears in both sources. Include graded items from the feed that the syllabus leaves out (for example pre-class, post-class, or SmartBook assignments), named cleanly (drop "- Due", lockdown browser notes, and similar clutter).
6. Only include items for THIS course. Ignore class meetings, office hours, and non-graded events.
7. Use clear short names a student would write, like "Quiz 3: Deep Learning Applications", "Exam 1", "Homework 4".
8. Dates are YYYY-MM-DD. Do not invent items or dates you cannot justify from the syllabus, the feed, or a stated rule.
9. Keep each note under 15 words, and leave it empty when the source and date are obvious. Put course-wide caveats in warnings once instead of repeating them per item.

Return the result by calling the submit_items tool exactly once. Do not reply with plain text.`;

const TOOL = {
  name: "submit_items",
  description: "Submit the final list of planner entries for this course.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            start: { type: "string", description: "YYYY-MM-DD due date, or start of the window" },
            end: { type: ["string", "null"], description: "YYYY-MM-DD end of window, or null" },
            kind: { type: "string", enum: ["exam", "quiz", "assignment", "project", "other"] },
            source: { type: "string", enum: ["syllabus", "brightspace", "rule"] },
            note: { type: "string", description: "Short reason, especially for computed or uncertain dates" },
          },
          required: ["name", "start", "kind", "source"],
        },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
        description: "Anything the student should double check",
      },
    },
    required: ["items"],
  },
};

export async function extractItems(
  input: ExtractInput
): Promise<{ items: RawItem[]; warnings: string[]; usage: { input: number; output: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on the server.");

  const feedLines = input.feedEvents
    .slice(0, 500)
    .map((e) => `${e.date} | ${e.summary}${e.course ? ` | ${e.course}` : ""}`)
    .join("\n");

  const context = [
    `Course: ${input.course.name} (${input.course.code || "no code"})`,
    input.course.meetingTimes ? `Meets: ${input.course.meetingTimes}` : "",
    `Semester runs ${input.semesterStart} to ${input.semesterEnd}.`,
    input.extraNotes ? `Student notes: ${input.extraNotes}` : "",
    "",
    input.feedEvents.length
      ? `Brightspace feed events (${input.feedMatchedByCourse ? "already filtered to this course" : "ALL courses, pick only this course's items"}):\n${feedLines}`
      : "No Brightspace feed events available.",
    "",
    input.pdfBase64 ? "The syllabus PDF is attached." : "No syllabus was uploaded; use the feed only.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const content: any[] = [];
  if (input.pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 },
    });
  }
  content.push({ type: "text", text: context });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      // Big courses (50+ items) plus the model's thinking need plenty of room
      max_tokens: 32000,
      system: SYSTEM,
      tools: [TOOL],
      // Newer models only accept "auto" here; the prompt tells it to call the tool
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }],
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`AI request failed (${res.status}): ${data?.error?.message ?? "unknown error"}`);
  }
  if (data.stop_reason === "max_tokens") {
    throw new Error(
      "The AI ran out of room before finishing this course's list. Try again, or add a note like \"skip attendance quizzes\" to shorten it."
    );
  }
  const blocks: any[] = data.content ?? [];
  const call = blocks.find((b) => b.type === "tool_use" && b.name === "submit_items");
  let payload: { items?: RawItem[]; warnings?: string[] } | null = call?.input ?? null;

  // Fallback: if the model answered in plain text, pull the JSON out of it
  if (!payload) {
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const match = text.match(/\{[\s\S]*"items"[\s\S]*\}/);
    if (match) {
      try {
        payload = JSON.parse(match[0]);
      } catch {
        payload = null;
      }
    }
  }
  if (!payload) throw new Error("The AI did not return a list of items. Try again.");

  const items: RawItem[] = (payload.items ?? []).filter(
    (i: RawItem) => i && i.name && /^\d{4}-\d{2}-\d{2}$/.test(i.start)
  );
  return {
    items,
    warnings: payload.warnings ?? [],
    usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
  };
}
