// Matches a course name like "Database Management for IS" to Brightspace's
// abbreviated label like "Database Mgmt for Info System 001".

const ABBREVIATIONS: Record<string, string> = {
  mgmt: "management",
  mgt: "management",
  info: "information",
  inf: "information",
  sys: "systems",
  system: "systems",
  devlpmt: "development",
  dev: "development",
  devel: "development",
  appl: "applied",
  app: "applied",
  bus: "business",
  busn: "business",
  acct: "accounting",
  acctg: "accounting",
  intro: "introduction",
  prin: "principles",
  princ: "principles",
  fund: "fundamentals",
  econ: "economics",
  fin: "finance",
  mkt: "marketing",
  mktg: "marketing",
  stat: "statistics",
  stats: "statistics",
  comp: "computer",
  sci: "science",
  eng: "engineering",
  engr: "engineering",
  org: "organizational",
  anlyt: "analytics",
  analyt: "analytics",
  adv: "advanced",
  ops: "operations",
  oper: "operations",
  db: "database",
  is: "information systems",
  ai: "artificial intelligence",
};

const STOP = new Set(["for", "and", "the", "of", "to", "in", "a", "an", "&"]);

/** Lowercase words with abbreviations expanded; very short words and section numbers dropped. */
export function courseWords(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    const expanded = ABBREVIATIONS[raw] ?? raw;
    for (const w of expanded.split(" ")) if (w.length >= 3) out.push(w);
  }
  return out;
}

// Compare word beginnings so "system" matches "systems" and "process" matches "processes"
const stem = (w: string) => w.slice(0, 6);

/** How many distinct words of the course name appear in the label. */
export function courseScore(courseName: string, courseCode: string, label: string): number {
  const want = new Set(courseWords(courseName).map(stem));
  const have = new Set(courseWords(label).map(stem));
  let score = 0;
  for (const w of want) if (have.has(w)) score++;
  // Course code like ISM324 appearing in the label is a strong signal
  const code = courseCode.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\d{3}$/, "");
  if (code.length >= 5 && label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(code)) score += 3;
  return score;
}

/** Pick the best label, or "" if nothing matches well enough (at least 2 words, and a clear winner). */
export function bestCourseMatch<T>(
  courseName: string,
  courseCode: string,
  candidates: T[],
  labelOf: (c: T) => string
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  let tie = false;
  for (const c of candidates) {
    const s = courseScore(courseName, courseCode, labelOf(c));
    if (s > bestScore) {
      best = c;
      bestScore = s;
      tie = false;
    } else if (s === bestScore && s > 0) {
      tie = true;
    }
  }
  return bestScore >= 2 && !tie ? best : null;
}
