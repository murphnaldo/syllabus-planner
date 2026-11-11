export type Course = {
  id: string;
  name: string;
  code: string;
  term: string;
  meetingTimes: string;
};

export type ExistingAssignment = {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
};

export type ItemSource = "syllabus" | "brightspace" | "rule";

export type PlannerItem = {
  key: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string | null; // YYYY-MM-DD for multi-day windows
  kind: "exam" | "quiz" | "assignment" | "project" | "other";
  source: ItemSource;
  note: string;
  duplicateOf: string | null;
  include: boolean;
};

export type FeedEvent = {
  summary: string;
  date: string; // local YYYY-MM-DD (America/New_York)
  course: string; // course label from LOCATION, if Brightspace sets it
  orgUnit: string; // Brightspace course ID from the event link, if present
};
