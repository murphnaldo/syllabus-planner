import { NextResponse } from "next/server";
import { feedCourses, fetchFeedText, parseIcs, parseIcsRaw } from "@/lib/ics";
import { getFeedUrl } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Lists the courses found in a Brightspace feed so the user can pick one.
 * Never returns the feed link itself. ?debug=1 adds field names from one event
 * (values cut short) to help when Brightspace changes its format.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { feedUrl?: string; debug?: boolean };
    const url = await getFeedUrl(req, body.feedUrl);
    if (!url) return NextResponse.json({ courses: [] });
    const text = await fetchFeedText(url);
    const courses = feedCourses(parseIcs(text));
    const result: Record<string, unknown> = { courses };
    if (body.debug) {
      const sample = parseIcsRaw(text).slice(0, 2).map((ev) =>
        Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, v.value.slice(0, 120)]))
      );
      result.sample = sample;
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
