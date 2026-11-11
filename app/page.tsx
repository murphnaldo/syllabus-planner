"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, PlannerItem } from "@/lib/types";
import { buildIcs } from "@/lib/icsExport";

type Step = "upload" | "review" | "done";
type Me =
  | { role: "owner"; feedConfigured: boolean }
  | { role: "guest"; name: string; used: number; limit: number };
type FeedCourse = { key: string; label: string; count: number; samples: string[] };

const SOURCE_LABEL: Record<PlannerItem["source"], string> = {
  syllabus: "From syllabus",
  brightspace: "From Brightspace",
  rule: "Generated from a rule",
};

function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Best guess at which Brightspace course matches the course being planned. */
function guessFeedCourse(feed: FeedCourse[], name: string, code: string): string {
  const words = name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const shortCode = code.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\d{3}$/, "");
  let best = "";
  let bestScore = 0;
  for (const f of feed) {
    const hay = `${f.label} ${f.samples.join(" ")}`.toLowerCase();
    let score = words.filter((w) => hay.includes(w)).length;
    if (shortCode.length >= 5 && hay.replace(/[^a-z0-9]/g, "").includes(shortCode)) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = f.key;
    }
  }
  return bestScore >= 2 ? best : "";
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [useFeed, setUseFeed] = useState(true);
  const [feedUrl, setFeedUrl] = useState("");
  const [feedCourses, setFeedCourses] = useState<FeedCourse[]>([]);
  const [feedCourseKey, setFeedCourseKey] = useState("");
  const [feedError, setFeedError] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [stats, setStats] = useState<{ feedEvents: number; existing: number } | null>(null);
  const [result, setResult] = useState<{ created: string[]; failed: { name: string; error: string }[] } | null>(null);
  const [plannedCourse, setPlannedCourse] = useState<Course | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const isOwner = me?.role === "owner";
  const feedAvailable = isOwner ? me.feedConfigured : feedUrl.trim().length > 0;

  useEffect(() => {
    setSemesterStart(load("sp_start"));
    setSemesterEnd(load("sp_end"));
    setFeedUrl(load("sp_feed"));
    fetch("/api/me")
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await r.json();
        setMe(data);
        if (data.role === "owner") {
          const c = await fetch("/api/courses").then((x) => x.json());
          if (c.error) setError(c.error);
          setCourses(c.courses ?? []);
        }
      })
      .catch(() => setError("Could not load your account."));
  }, []);

  // Load the list of Brightspace courses once a feed is available
  useEffect(() => {
    if (!me || !feedAvailable) {
      setFeedCourses([]);
      return;
    }
    const t = setTimeout(() => {
      setFeedError("");
      fetch("/api/feed-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isOwner ? {} : { feedUrl }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setFeedError(data.error);
          setFeedCourses(data.courses ?? []);
        })
        .catch(() => setFeedError("Could not read the Brightspace feed."));
    }, isOwner ? 0 : 600);
    return () => clearTimeout(t);
  }, [me, feedAvailable, feedUrl, isOwner]);

  const course = courses.find((c) => c.id === courseId);
  const planName = isOwner ? course?.name ?? "" : courseName;
  const planCode = isOwner ? course?.code ?? "" : courseCode;

  // Auto-pick the matching Brightspace course when the course changes
  useEffect(() => {
    if (feedCourses.length && planName) setFeedCourseKey(guessFeedCourse(feedCourses, planName, planCode));
  }, [feedCourses, planName, planCode]);

  const selectedCount = items.filter((i) => i.include).length;
  const terms = useMemo(() => Array.from(new Set(courses.map((c) => c.term || "Other"))), [courses]);
  const runsLeft = me?.role === "guest" ? Math.max(0, me.limit - me.used) : null;

  async function extract() {
    setBusy(true);
    setError("");
    save("sp_start", semesterStart);
    save("sp_end", semesterEnd);
    if (!isOwner) save("sp_feed", feedUrl.trim());
    const form = new FormData();
    if (isOwner) form.set("courseId", courseId);
    else {
      form.set("courseName", courseName);
      form.set("courseCode", courseCode);
    }
    form.set("semesterStart", semesterStart);
    form.set("semesterEnd", semesterEnd);
    form.set("useFeed", String(useFeed && feedAvailable));
    if (!isOwner && useFeed) form.set("feedUrl", feedUrl.trim());
    if (feedCourseKey) form.set("feedCourseKey", feedCourseKey);
    form.set("notes", notes);
    if (file) form.set("syllabus", file);
    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setItems(data.items);
      setWarnings(data.warnings ?? []);
      setStats(data.stats);
      setPlannedCourse(data.course);
      if (data.usage && me?.role === "guest") setMe({ ...me, used: data.usage.used, limit: data.usage.limit });
      setStep("review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function update(key: string, patch: Partial<PlannerItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function addBlank() {
    const today = new Date().toISOString().slice(0, 10);
    setItems((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        name: "",
        start: today,
        end: null,
        kind: "assignment",
        source: "syllabus",
        note: "Added by you",
        duplicateOf: null,
        include: true,
      },
    ]);
  }

  const chosen = () => items.filter((i) => i.include && i.name.trim() && i.start);

  function downloadIcs() {
    const label = plannedCourse?.code || plannedCourse?.name || "";
    const slug = (label || "syllabus").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    download(`${slug}-planner.ics`, buildIcs(chosen(), label));
  }

  async function send() {
    const picked = chosen();
    if (picked.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, items: picked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send to Notion.");
      setResult(data);
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("upload");
    setItems([]);
    setWarnings([]);
    setResult(null);
    setFile(null);
    setNotes("");
  }

  async function signOut() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/login";
  }

  const canRun =
    !busy &&
    !!semesterStart &&
    !!semesterEnd &&
    (isOwner ? !!courseId : !!courseName.trim()) &&
    (!!file || (useFeed && feedAvailable)) &&
    (runsLeft === null || runsLeft > 0);

  if (!me) {
    return (
      <main className="shell">
        <h1>Syllabus Planner</h1>
        <p className="muted">{error || "Loading..."}</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <h1>Syllabus Planner</h1>
        <button onClick={signOut} className="small">Sign out</button>
      </div>
      <p className="muted">
        {isOwner
          ? "Syllabus and Brightspace in, Notion Student Planner out."
          : `Hi ${me.name}. Turn a syllabus into a calendar file you can import anywhere. ${runsLeft} of ${me.limit} runs left this semester.`}
      </p>

      {error && <p className="warn">{error}</p>}

      {step === "upload" && (
        <>
          <section className="card stack">
            <h2>1. Course and semester</h2>
            {isOwner ? (
              <label>
                Course
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">Choose a course from Notion</option>
                  {terms.map((term) => (
                    <optgroup key={term} label={term}>
                      {courses
                        .filter((c) => (c.term || "Other") === term)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.code ? ` (${c.code})` : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid">
                <label>
                  Course name
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Accounting Principles I"
                  />
                </label>
                <label>
                  Course code (optional)
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="ACCT 201"
                  />
                </label>
              </div>
            )}
            <div className="grid">
              <label>
                First day of classes
                <input type="date" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} />
              </label>
              <label>
                Last day (including finals)
                <input type="date" value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="card stack">
            <h2>2. Sources</h2>
            <div
              className={`drop ${file ? "has" : ""}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
            >
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <div className="small muted" style={{ margin: 0 }}>Tap to choose a different file</div>
                </>
              ) : (
                <>
                  <strong>Drop the syllabus PDF here</strong>
                  <div className="small muted" style={{ margin: 0 }}>or tap to choose a file</div>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {!isOwner && (
              <label>
                Brightspace calendar link (optional, but catches assignments the syllabus leaves out)
                <input
                  type="text"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="Brightspace > Calendar > Subscribe > copy the link"
                />
                <span className="small muted" style={{ margin: 0, fontWeight: 400 }}>
                  Saved only on this device. Treat it like a password.
                </span>
              </label>
            )}

            <label className="inline">
              <input
                type="checkbox"
                checked={useFeed && feedAvailable}
                disabled={!feedAvailable}
                onChange={(e) => setUseFeed(e.target.checked)}
              />
              Also pull exact due dates from Brightspace
              {!feedAvailable && <span className="small muted" style={{ margin: 0 }}>(no feed link yet)</span>}
            </label>

            {useFeed && feedAvailable && (
              <label>
                Brightspace course
                <select value={feedCourseKey} onChange={(e) => setFeedCourseKey(e.target.value)}>
                  <option value="">Let the AI figure it out</option>
                  {feedCourses.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} ({f.count} events{f.samples[0] ? `, e.g. ${f.samples[0].slice(0, 40)}` : ""})
                    </option>
                  ))}
                </select>
                {feedError && <span className="error small">{feedError}</span>}
              </label>
            )}

            <label>
              Anything the AI should know? (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example: exams are always on Wednesdays"
              />
            </label>
          </section>

          <button className="primary" onClick={extract} disabled={!canRun}>
            {busy
              ? "Reading the syllabus... (up to a minute for big courses)"
              : runsLeft === 0
                ? "No runs left this semester"
                : "Find assignments and exams"}
          </button>
        </>
      )}

      {step === "review" && (
        <>
          <section className="card">
            <div className="toolbar">
              <div>
                <h2 style={{ margin: 0 }}>Review for {plannedCourse?.name}</h2>
                {stats && (
                  <div className="small muted" style={{ margin: 0 }}>
                    {items.length} found, {stats.feedEvents} Brightspace events checked
                    {isOwner ? `, ${stats.existing} already in Notion` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setItems((p) => p.map((i) => ({ ...i, include: true })))}>All</button>
                <button onClick={() => setItems((p) => p.map((i) => ({ ...i, include: false })))}>None</button>
              </div>
            </div>

            {warnings.map((w, i) => (
              <p key={i} className="warn">{w}</p>
            ))}

            {items.length === 0 && <p className="muted">Nothing found. Try adding notes or checking the dates.</p>}

            {items.map((item) => (
              <div key={item.key} className={`item ${item.include ? "" : "off"}`}>
                <input
                  type="checkbox"
                  checked={item.include}
                  onChange={(e) => update(item.key, { include: e.target.checked })}
                  aria-label={`Include ${item.name}`}
                />
                <div>
                  <div className="item-fields">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => update(item.key, { name: e.target.value })}
                      placeholder="Name"
                    />
                    <input
                      type="date"
                      value={item.start}
                      onChange={(e) => update(item.key, { start: e.target.value })}
                      aria-label="Due date or start"
                    />
                    <input
                      type="date"
                      value={item.end ?? ""}
                      onChange={(e) => update(item.key, { end: e.target.value || null })}
                      aria-label="End date (optional)"
                      title="End date, for exam windows"
                    />
                  </div>
                  <div className="item-meta">
                    <span className="tag">{item.kind}</span>
                    <span className="tag">{SOURCE_LABEL[item.source]}</span>
                    {item.duplicateOf && <span className="tag dupe">Already in Notion as "{item.duplicateOf}"</span>}
                    {item.note && <span>{item.note}</span>}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <button onClick={addBlank}>+ Add an item</button>
            </div>
          </section>

          <div className="toolbar">
            <button onClick={reset} disabled={busy}>Start over</button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={downloadIcs} disabled={busy || selectedCount === 0} className={isOwner ? "" : "primary"}>
                Download {selectedCount} as calendar file
              </button>
              {isOwner && (
                <button className="primary" onClick={send} disabled={busy || selectedCount === 0}>
                  {busy ? "Adding to Notion..." : `Add ${selectedCount} to Notion`}
                </button>
              )}
            </div>
          </div>
          {!isOwner && (
            <p className="small muted">
              Import the file: Google Calendar (Settings, Import), Apple Calendar (File, Import), or Outlook (Add calendar, Upload from file).
            </p>
          )}
        </>
      )}

      {step === "done" && result && (
        <section className="card stack">
          <p className="ok">Added {result.created.length} item{result.created.length === 1 ? "" : "s"} to your Student Planner.</p>
          {result.failed.length > 0 && (
            <div>
              <p className="error">{result.failed.length} could not be added:</p>
              <ul>
                {result.failed.map((f) => (
                  <li key={f.name}>{f.name}: {f.error}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="primary" onClick={reset}>Do another course</button>
        </section>
      )}
    </main>
  );
}
