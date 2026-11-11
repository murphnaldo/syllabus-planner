import type { FeedEvent } from "./types";

const TZ = "America/New_York";

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

export function parseIcs(text: string): FeedEvent[] {
  const events: FeedEvent[] = [];
  let current: Record<string, { value: string; params: string }> | null = null;

  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        const dt = current.DTSTART ?? current.DTEND ?? current.DUE;
        const date = dt ? icsDateToLocal(dt.value, dt.params) : null;
        const summary = current.SUMMARY ? unescape(current.SUMMARY.value) : "";
        if (date && summary) {
          const course = unescape(current.LOCATION?.value ?? current["X-D2L-ORGUNIT"]?.value ?? "");
          events.push({ summary, date, course });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...rest] = head.split(";");
    current[name.toUpperCase()] = { value, params: rest.join(";") };
  }
  return events;
}

export async function fetchFeed(url: string): Promise<FeedEvent[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Brightspace feed returned ${res.status}`);
  return parseIcs(await res.text());
}

/** Keep events inside the semester and, when possible, for this course. */
export function filterForCourse(
  events: FeedEvent[],
  course: { name: string; code: string },
  from: string,
  to: string
): { matched: FeedEvent[]; matchedByCourse: boolean } {
  const inRange = events.filter((e) => e.date >= from && e.date <= to);
  const code = course.code.replace(/[^a-z0-9]/gi, "").toLowerCase(); // ISM250001
  const shortCode = code.replace(/\d{3}$/, ""); // ISM250
  const nameWords = course.name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

  const matched = inRange.filter((e) => {
    const hay = `${e.course} ${e.summary}`.toLowerCase();
    const hayCompact = hay.replace(/[^a-z0-9]/g, "");
    if (shortCode && hayCompact.includes(shortCode)) return true;
    const hits = nameWords.filter((w) => hay.includes(w)).length;
    return nameWords.length > 0 && hits >= Math.min(2, nameWords.length);
  });
  return matched.length > 0
    ? { matched, matchedByCourse: true }
    : { matched: inRange, matchedByCourse: false };
}
