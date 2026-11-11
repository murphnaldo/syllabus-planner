// Quick self-check for the Brightspace feed parser, dedupe, and course filter.
import assert from "node:assert/strict";
import { parseIcs, filterForCourse } from "../lib/ics.ts";
import { findDuplicate } from "../lib/dedupe.ts";

const sample = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:Post-Class Assignment 10 - Due",
  "DTSTART:20261114T045900Z",
  "LOCATION:Accounting Principles I 001",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Midterm Exam 2 Part 1 25 multipe-choice Questions - Requires Respondus Lock",
  " Down Browser + Webcam - Due",
  "DTSTART:20261114T045900Z",
  "LOCATION:Intro to Applied AI and IS 001",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Labor Day",
  "DTSTART;VALUE=DATE:20260907",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Old event",
  "DTSTART;TZID=America/New_York:20260301T090000",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const events = parseIcs(sample);
assert.equal(events.length, 4);
// 04:59 UTC on Nov 14 is 11:59 PM Eastern on Nov 13
assert.equal(events[0].date, "2026-11-13");
assert.equal(events[0].course, "Accounting Principles I 001");
// Folded line rejoined
assert.ok(events[1].summary.includes("LockDown Browser"));
assert.equal(events[2].date, "2026-09-07");
assert.equal(events[3].date, "2026-03-01");

const ai = filterForCourse(events, { name: "Intro to Applied AI and IS", code: "ISM250-001" }, "2026-08-24", "2026-12-13");
assert.equal(ai.matchedByCourse, true);
assert.equal(ai.matched.length, 1);

const acct = filterForCourse(events, { name: "Accounting Principles I", code: "" }, "2026-08-24", "2026-12-13");
assert.equal(acct.matched.length, 1);
assert.equal(acct.matched[0].summary, "Post-Class Assignment 10 - Due");

const existing = [
  { id: "1", name: "Midterm 2 MCQ and Case Study", start: "2026-11-09", end: "2026-11-13" },
  { id: "2", name: "Assignment 4", start: "2026-10-30", end: null },
];
assert.equal(findDuplicate("Midterm 2", "2026-11-13", null, existing), "Midterm 2 MCQ and Case Study");
assert.equal(findDuplicate("Assignment 4: Train a Simple Predictive Model", "2026-10-30", null, existing), "Assignment 4");
assert.equal(findDuplicate("Assignment 5", "2026-11-06", null, existing), null);

// Same date and same number, but different kinds of work: not duplicates
const existing2 = [
  { id: "3", name: "Assignment 2", start: "2026-09-25", end: null },
  { id: "4", name: "Assignment 3", start: "2026-10-02", end: null },
  { id: "5", name: "Quiz 5 LLMs", start: "2026-10-23", end: null },
  { id: "6", name: "Midterm", start: "2026-10-05", end: "2026-10-09" },
];
assert.equal(findDuplicate("Quiz 2: Machine Learning Basics", "2026-09-25", null, existing2), null);
assert.equal(findDuplicate("Quiz 3: Deep Learning Applications", "2026-10-02", null, existing2), null);
assert.equal(findDuplicate("Vote for Your Favorite Student App", "2026-09-25", null, existing2), null);
assert.equal(findDuplicate("Assignment 2: Vibe Coding and Data Visualization", "2026-09-25", null, existing2), "Assignment 2");
assert.equal(findDuplicate("Quiz 5: LLMs", "2026-10-23", null, existing2), "Quiz 5 LLMs");
assert.equal(findDuplicate("Quiz 7: LLMs Evaluation", "2026-10-23", null, existing2), null);
assert.equal(findDuplicate("Midterm 1", "2026-10-09", null, existing2), "Midterm");

console.log("All checks passed");
