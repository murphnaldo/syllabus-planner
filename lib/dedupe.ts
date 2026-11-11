import type { ExistingAssignment } from "./types";

const STOP = new Set([
  "the", "and", "a", "an", "of", "for", "to", "in", "on", "your", "due", "part",
  "requires", "respondus", "lockdown", "browser", "webcam", "mini",
]);

// Words that describe a type of work rather than its topic
const KIND_WORDS = new Set([
  "quiz", "assignment", "homework", "hw", "exam", "midterm", "final", "project", "lab", "test",
]);
// For these, "Midterm" and "Midterm 1" in the same week are the same thing
const EXAM_WORDS = new Set(["exam", "midterm", "final", "test"]);

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w))
  );
}

const isNumber = (w: string) => /^\d+$/.test(w);

function overlaps(start: string, end: string | null, ex: ExistingAssignment): boolean {
  if (!ex.start) return false;
  const exStart = ex.start.slice(0, 10);
  const exEnd = (ex.end ?? ex.start).slice(0, 10);
  return start <= exEnd && exStart <= (end ?? start);
}

function isMatch(name: string, start: string, end: string | null, ex: ExistingAssignment): boolean {
  const A = tokens(name);
  const B = tokens(ex.name);
  if (A.size === 0 || B.size === 0) return false;

  const kindsA = [...A].filter((w) => KIND_WORDS.has(w));
  const kindsB = [...B].filter((w) => KIND_WORDS.has(w));
  // "Quiz 2" and "Assignment 2" are different things
  if (kindsA.length && kindsB.length && !kindsA.some((k) => kindsB.includes(k))) return false;
  const sharedKind = kindsA.filter((k) => kindsB.includes(k));

  const numsA = [...A].filter(isNumber);
  const numsB = [...B].filter(isNumber);
  const bothNumbered = numsA.length > 0 && numsB.length > 0;
  const numMatch = bothNumbered && numsA.some((n) => numsB.includes(n));

  const topicShared = [...A].filter((w) => B.has(w) && !isNumber(w) && !KIND_WORDS.has(w));

  if (overlaps(start, end, ex)) {
    if (numMatch && (sharedKind.length || topicShared.length)) return true; // Assignment 4 / Assignment 4: Predictive Model
    if (topicShared.length) return true; // Quiz 6: RAG / Quiz 7 RAG
    if (!bothNumbered && sharedKind.some((k) => EXAM_WORDS.has(k))) return true; // Midterm / Midterm 1
    return false;
  }

  // Different dates: only near-identical names count
  if (bothNumbered && !numMatch) return false;
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared / Math.min(A.size, B.size) >= 0.9;
}

/** Returns the name of a likely-matching existing entry, or null. */
export function findDuplicate(
  name: string,
  start: string,
  end: string | null,
  existing: ExistingAssignment[]
): string | null {
  return existing.find((ex) => isMatch(name, start, end, ex))?.name ?? null;
}
