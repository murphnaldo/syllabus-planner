import { bestCourseMatch } from "./courseMatch.ts";
import type { FeedEvent } from "./types";

const TZ = "America/New_York";
export const NO_LABEL = "(no course label)";

/** Undo RFC 5545 line folding and escaping. */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/** Convert an iCal DTSTART/DTEND value to a local (Eastern) YYYY-MM-DD date. */
export function icsDateToLocal(value: string, params: string): string | null {
  const v = value.trim();
  // All-day: 20261113
  if (/^\d{8}$/.test(v) || /VALUE=DATE(?!-)/i.test(params)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) {
    // UTC: convert to Eastern so 11:59 PM due dates land on the right day
    const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
  // Floating or TZID time: the wall-clock date is already local
  return `${y}-${mo}-${d}`;
}

type RawEvent = Record<string, { value: string; params: string }>;

/** Brightspace links look like /d2l/le/calendar/4851232/... or ?ou=4851232 */
export function findOrgUnit(ev: RawEvent): string {
  for (const key of ["URL", "DESCRIPTION", "X-ALT-DESC", "UID", "LOCATION"]) {
    const v = ev[key]?.value ?? "";
    const m =
      v.match(/\/d2l\/(?:le|lms|home)\/(?:[a-z]+\/)*?(\d{4,})(?:\/|\b)/i) ||
      v.match(/[?&]ou=(\d{4,})/i) ||
      v.match(/\/d2l\/home\/(\d{4,})/i);
    if (m) return m[1];
  }
  return "";
}

export function parseIcsRaw(text: string): RawEvent[] {
  const out: RawEvent[] = [];
  let current: RawEvent | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) out.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const [name, ...rest] = line.slice(0, idx).split(";");
    current[name.toUpperCase()] = { value: line.slice(idx + 1), params: rest.join(";") };
  }
  return out;
}

export function parseIcs(text: string): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (const ev of parseIcsRaw(text)) {
    const dt = ev.DTSTART ?? ev.DTEND ?? ev.DUE;
    const date = dt ? icsDateToLocal(dt.value, dt.params) : null;
    const summary = ev.SUMMARY ? unescape(ev.SUMMARY.value) : "";
    if (!date || !summary) continue;
    const course = unescape(ev.LOCATION?.value ?? ev["X-D2L-ORGUNIT"]?.value ?? "");
    events.push({ summary, date, course, orgUnit: findOrgUnit(ev) });
  }
  return events;
}

/** Group feed events into the courses they belong to, for the course picker. */
export function feedCourses(events: FeedEvent[]): { key: string; label: string; count: number; samples: string[] }[] {
  const groups = new Map<string, { label: string; count: number; samples: string[] }>();
  for (const e of events) {
    const key = e.orgUnit || e.course || NO_LABEL;
    const g = groups.get(key) ?? { label: e.course || "", count: 0, samples: [] };
    if (!g.label && e.course) g.label = e.course;
    g.count++;
    if (g.samples.length < 4 && !g.samples.includes(e.summary)) g.samples.push(e.summary);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label || `Course ${key}`, count: g.count, samples: g.samples }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchFeedText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store", redirect: "error" });
  if (!res.ok) throw new Error(`Brightspace feed returned ${res.status}`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link didn't return a calendar.");
  return text;
}

export async function fetchFeed(url: string): Promise<FeedEvent[]> {
  return parseIcs(await fetchFeedText(url));
}

/** Keep events inside the semester and, when possible, for this course. */
export function filterForCourse(
  events: FeedEvent[],
  course: { name: string; code: string },
  from: string,
  to: string,
  courseKey?: string | null
): { matched: FeedEvent[]; matchedByCourse: boolean } {
  const inRange = events.filter((e) => e.date >= from && e.date <= to);
  // The user picked the Brightspace course: filter strictly by it
  if (courseKey) {
    const picked =
      courseKey === NO_LABEL
        ? inRange.filter((e) => !e.orgUnit && !e.course)
        : inRange.filter((e) => e.orgUnit === courseKey || e.course === courseKey);
    return { matched: picked, matchedByCourse: true };
  }
  // No pick: find the Brightspace course whose (often abbreviated) name matches best
  const labels = [...new Set(inRange.map((e) => e.course).filter(Boolean))];
  const best = bestCourseMatch(course.name, course.code, labels, (l) => l);
  if (best) {
    return { matched: inRange.filter((e) => e.course === best), matchedByCourse: true };
  }
  return { matched: inRange, matchedByCourse: false };
}
