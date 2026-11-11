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
2. SKIP extra credit, optional work, surveys, ungraded warm-ups, and anything "not in grade book".
3. GENERATE rule-based items. If the syllabus states a rule like "homework due at the beginning of class on Mondays for 12 weeks", create one entry per occurrence on the correct dates. Skip university holidays (for Fall: Labor Day, Thanksgiving break; for Spring: MLK Day, spring break) when the syllabus or common sense says no class meets.
4. WEEK-ONLY dates: if an exam or item is only given as "Week N", compute that week from the semester start date (week 1 starts on the start date's week, Monday to Friday). If the exact day is unknown, use a date range covering that class week (start = Monday, end = Friday), and say so in the note.
5. PREFER the Brightspace feed's exact dates when the same item appears in both sources. Include graded items from the feed that the syllabus leaves out (for example pre-class, post-class, or SmartBook assignments), named cleanly (drop "- Due", lockdown browser notes, and similar clutter).
6. Only include items for THIS course. Ignore class meetings, office hours, and non-graded events.
7. Use clear short names a student would write, like "Quiz 3: Deep Learning Applications", "Exam 1", "Homework 4".
8. Dates are YYYY-MM-DD. Do not invent items or dates you cannot justify from the syllabus, the feed, or a stated rule.

Return the result by calling the submit_items tool exactly once.`;

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
      max_tokens: 8000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "submit_items" },
      messages: [{ role: "user", content }],
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`AI request failed (${res.status}): ${data?.error?.message ?? "unknown error"}`);
  }
  const call = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!call) throw new Error("The AI did not return a list of items.");

  const items: RawItem[] = (call.input.items ?? []).filter(
    (i: RawItem) => i && i.name && /^\d{4}-\d{2}-\d{2}$/.test(i.start)
  );
  return {
    items,
    warnings: call.input.warnings ?? [],
    usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
  };
}
