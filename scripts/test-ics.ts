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
assert.equal(findDuplicate("Quiz 7: LLMs Evaluation", "2026-11-27", null, existing2), null);
assert.equal(findDuplicate("Midterm 1", "2026-10-09", null, existing2), "Midterm");

// Cases from the first real ISM 250 run
const ism250 = [
  { id: "a", name: "Assignment 2", start: "2026-09-25", end: null },
  { id: "b", name: "Quiz 2 Machine Learning", start: "2026-09-25", end: null },
  { id: "c", name: "Quiz 7 RAG", start: "2026-10-30", end: null },
  { id: "d", name: "Assignment 4", start: "2026-10-30", end: null },
  { id: "e", name: "Midterm", start: "2026-10-09", end: null },
];
assert.equal(findDuplicate("Mini Assignment: Vote for Your Favorite Student App", "2026-09-25", null, ism250), null);
assert.equal(findDuplicate("Quiz 2: Machine Learning Basics", "2026-09-25", null, ism250), "Quiz 2 Machine Learning");
assert.equal(findDuplicate("Quiz 6: RAG", "2026-10-30", null, ism250), "Quiz 7 RAG");
assert.equal(findDuplicate("Assignment 4: Train a Simple Predictive Model", "2026-10-30", null, ism250), "Assignment 4");
assert.equal(findDuplicate("Midterm Exam 1: MCQ and Vibe Coding/Data Analytics", "2026-10-09", null, ism250), "Midterm");
assert.equal(findDuplicate("Final Exam", "2026-12-07", "2026-12-11", ism250), null);

// Cases from the ACCT 201 run (Aaron's Notion uses generic names on matching dates)
const acctNotion = [
  { id: "p1", name: "Practice Exam (bonus points)", start: "2026-09-23", end: null },
  { id: "p2", name: "Practice Exam 2", start: "2026-10-28", end: null },
  { id: "s7", name: "Smartbook Chapter 7", start: "2026-10-12", end: null },
  { id: "s1", name: "Smartbook Chapter 1", start: "2026-08-31", end: null },
  { id: "pc", name: "Post-class Assignment (2)", start: "2026-09-09", end: null },
  { id: "pr", name: "Pre-class Assignment 2 (2)", start: "2026-09-17", end: null },
  { id: "pj", name: "Project 2", start: "2026-11-02", end: null },
];
assert.equal(findDuplicate("Exam 1", "2026-09-23", null, acctNotion), null);
assert.equal(findDuplicate("Exam 2", "2026-10-28", null, acctNotion), null);
assert.equal(findDuplicate("Practice Exam 2", "2026-10-28", null, acctNotion), "Practice Exam 2");
assert.equal(findDuplicate("Chapter 6 Concept Overview Video", "2026-10-12", null, acctNotion), null);
assert.equal(findDuplicate("Chapter 1 SmartBook", "2026-08-31", null, acctNotion), "Smartbook Chapter 1");
assert.equal(findDuplicate("Post-Class Assignment 2", "2026-09-09", null, acctNotion), "Post-class Assignment (2)");
assert.equal(findDuplicate("Pre-Class Assignment 3.2", "2026-09-17", null, acctNotion), "Pre-class Assignment 2 (2)");
assert.equal(findDuplicate("Project 2: Great Adventures", "2026-11-02", null, acctNotion), "Project 2");

console.log("All checks passed");

// ---- Course picker: org unit IDs from Brightspace event links ----
import { parseIcs as parseIcs2, feedCourses, NO_LABEL } from "../lib/ics.ts";
const withLinks = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:Homework 6 - Due",
  "DTSTART:20261019T193000Z",
  "URL:https://brightspace.uakron.edu/d2l/le/calendar/5550001/event/123/detailsview",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Quiz 7 - Due",
  "DTSTART:20261019T193000Z",
  "DESCRIPTION:View event: https://brightspace.uakron.edu/d2l/home/5550001",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Post-Class Assignment 3 - Due",
  "DTSTART:20260915T035900Z",
  "LOCATION:Accounting Principles I 001",
  "URL:https://brightspace.uakron.edu/d2l/le/calendar/4444444/event/9/detailsview",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Mystery event",
  "DTSTART:20261001T120000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");
const ev2 = parseIcs2(withLinks);
assert.equal(ev2[0].orgUnit, "5550001");
assert.equal(ev2[1].orgUnit, "5550001");
assert.equal(ev2[2].orgUnit, "4444444");
const groups = feedCourses(ev2);
assert.equal(groups[0].key, "5550001");
assert.equal(groups[0].count, 2);
assert.ok(groups.some((g) => g.key === NO_LABEL));
const strict = filterForCourse(ev2, { name: "Whatever", code: "" }, "2026-08-24", "2026-12-13", "5550001");
assert.equal(strict.matched.length, 2);

// ---- Calendar export ----
import { buildIcs } from "../lib/icsExport.ts";
const ics = buildIcs(
  [
    { key: "a", name: "Final Exam", start: "2026-12-07", end: "2026-12-11", kind: "exam", source: "rule", note: "Week 16, exact day not given", duplicateOf: null, include: true },
    { key: "b", name: "Homework 4, part 2; data", start: "2026-12-31", end: null, kind: "assignment", source: "syllabus", note: "", duplicateOf: null, include: true },
  ],
  "ISM 324",
  new Date("2026-11-11T12:00:00Z")
);
assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
assert.ok(ics.includes("DTSTART;VALUE=DATE:20261207\r\nDTEND;VALUE=DATE:20261212"));
assert.ok(ics.includes("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101"), "end rolls into next year");
assert.ok(ics.includes(String.raw`SUMMARY:ISM 324: Homework 4\, part 2\; data`), "commas and semicolons escaped");
assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2);
assert.ok(ics.split("\r\n").every((l) => l.length <= 75), "lines folded");

// ---- Signed sessions ----
import { createSessionToken, readSession } from "../lib/auth.ts";
process.env.APP_PASSWORD = "owner-pass";
const tok = await createSessionToken({ role: "guest", code: "ABC123", name: "Jordan" });
assert.deepEqual(await readSession(tok), { role: "guest", code: "ABC123", name: "Jordan" });
const ownerTok = await createSessionToken({ role: "owner" });
assert.deepEqual(await readSession(ownerTok), { role: "owner" });
// Tampering: turn a guest token into owner without the signature
const forged = Buffer.from(JSON.stringify({ role: "owner" })).toString("base64url") + "." + tok.split(".")[1];
assert.equal(await readSession(forged), null);
assert.equal(await readSession("garbage"), null);
process.env.APP_PASSWORD = "changed";
assert.equal(await readSession(ownerTok), null, "changing the password signs everyone out");

// ---- Feed link validation ----
import { isFeedUrl } from "../lib/feedUrl.ts";
assert.equal(isFeedUrl("https://brightspace.uakron.edu/d2l/le/calendar/feed/user/feed.ics?token=abc"), true);
assert.equal(isFeedUrl("http://brightspace.uakron.edu/d2l/le/calendar/feed/user/feed.ics"), false);
assert.equal(isFeedUrl("https://evil.example.com/steal"), false);
assert.equal(isFeedUrl("not a url"), false);

console.log("All new checks passed");
