import type { PlannerItem } from "./types";

// Builds a standard .ics calendar file (RFC 5545) that Google, Apple, and Outlook can import.

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines over 75 characters must be folded onto continuation lines starting with a space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

const compact = (d: string) => d.replace(/-/g, "");

/** All-day events use an exclusive end date, so a Dec 7 to Dec 11 window ends on Dec 12. */
function dayAfter(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

export function buildIcs(items: PlannerItem[], courseLabel: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const prefix = courseLabel ? `${courseLabel}: ` : "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Syllabus Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(courseLabel || "Syllabus Planner")}`,
  ];
  items.forEach((item, i) => {
    const uid = `${compact(item.start)}-${i}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}@syllabus-planner`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(item.start)}`,
      `DTEND;VALUE=DATE:${compact(dayAfter(item.end ?? item.start))}`,
      `SUMMARY:${escapeText(prefix + item.name)}`,
      ...(item.note ? [`DESCRIPTION:${escapeText(item.note)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
