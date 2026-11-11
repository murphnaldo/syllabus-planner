import type { ExistingAssignment } from "./types";

const STOP = new Set(["the", "and", "a", "an", "of", "for", "to", "in", "on", "due", "requires", "respondus", "lockdown", "browser", "webcam"]);

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w))
  );
}

function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

function overlaps(start: string, end: string | null, ex: ExistingAssignment): boolean {
  if (!ex.start) return false;
  const exStart = ex.start.slice(0, 10);
  const exEnd = (ex.end ?? ex.start).slice(0, 10);
  const s = start;
  const e = end ?? start;
  return s <= exEnd && exStart <= e;
}

/** Returns the name of a likely-matching existing entry, or null. */
export function findDuplicate(
  name: string,
  start: string,
  end: string | null,
  existing: ExistingAssignment[]
): string | null {
  for (const ex of existing) {
    const sim = similarity(name, ex.name);
    const sameWindow = overlaps(start, end, ex);
    // Same date and clearly related name, or a near-identical name anywhere
    if ((sameWindow && sim >= 0.5) || sim >= 0.9) return ex.name;
  }
  return null;
}
