import type { Course, ExistingAssignment, PlannerItem } from "./types";

const NOTION_VERSION = "2022-06-28";
const COURSES_DB = () => process.env.NOTION_COURSES_DB || "3b961d004d7080779e4cce9f9c770057";
const ASSIGNMENTS_DB = () => process.env.NOTION_ASSIGNMENTS_DB || "26261d004d7081e3ade1c25fb0f79ac4";

async function notion<T = any>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set on the server.");
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint =
      res.status === 404
        ? " (Is the Syllabus Planner integration connected to your Student Planner page?)"
        : "";
    throw new Error(`Notion error ${res.status}: ${data.message ?? "unknown"}${hint}`);
  }
  return data as T;
}

const text = (prop: any): string =>
  (prop?.rich_text ?? prop?.title ?? []).map((t: any) => t.plain_text).join("").trim();

async function queryAll(dbId: string, body: Record<string, unknown>): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const page: any = await notion(`/databases/${dbId}/query`, {
      ...body,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return results;
}

export async function listCourses(): Promise<Course[]> {
  const pages = await queryAll(COURSES_DB(), {
    sorts: [{ property: "Name", direction: "ascending" }],
  });
  return pages.map((p) => ({
    id: p.id,
    name: text(p.properties.Name),
    code: text(p.properties["Course Code"]),
    term: p.properties.Term?.select?.name ?? "",
    meetingTimes: text(p.properties["Meeting Times"]),
  }));
}

export async function listAssignmentsForCourse(courseId: string): Promise<ExistingAssignment[]> {
  const pages = await queryAll(ASSIGNMENTS_DB(), {
    filter: { property: "Course", relation: { contains: courseId } },
  });
  return pages.map((p) => ({
    id: p.id,
    name: text(p.properties.Homework),
    start: p.properties.Deadline?.date?.start ?? null,
    end: p.properties.Deadline?.date?.end ?? null,
  }));
}

export async function createAssignment(item: PlannerItem, courseId: string): Promise<string> {
  const page: any = await notion("/pages", {
    parent: { database_id: ASSIGNMENTS_DB() },
    properties: {
      Homework: { title: [{ text: { content: item.name.slice(0, 200) } }] },
      Deadline: { date: { start: item.start, ...(item.end ? { end: item.end } : {}) } },
      Course: { relation: [{ id: courseId }] },
      Done: { checkbox: false },
    },
  });
  return page.url as string;
}
