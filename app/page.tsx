"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, PlannerItem } from "@/lib/types";

type Step = "upload" | "review" | "done";

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

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [feedConfigured, setFeedConfigured] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [useFeed, setUseFeed] = useState(true);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [stats, setStats] = useState<{ feedEvents: number; existing: number } | null>(null);
  const [result, setResult] = useState<{ created: string[]; failed: { name: string; error: string }[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSemesterStart(load("sp_start"));
    setSemesterEnd(load("sp_end"));
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        setCourses(data.courses ?? []);
        setFeedConfigured(Boolean(data.feedConfigured));
      })
      .catch(() => setError("Could not load your courses from Notion."));
  }, []);

  const course = courses.find((c) => c.id === courseId);
  const selectedCount = items.filter((i) => i.include).length;
  const terms = useMemo(() => Array.from(new Set(courses.map((c) => c.term || "Other"))), [courses]);

  async function extract() {
    setBusy(true);
    setError("");
    save("sp_start", semesterStart);
    save("sp_end", semesterEnd);
    const form = new FormData();
    form.set("courseId", courseId);
    form.set("semesterStart", semesterStart);
    form.set("semesterEnd", semesterEnd);
    form.set("useFeed", String(useFeed && feedConfigured));
    form.set("notes", notes);
    if (file) form.set("syllabus", file);
    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setItems(data.items);
      setWarnings(data.warnings ?? []);
      setStats(data.stats);
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

  async function send() {
    const chosen = items.filter((i) => i.include && i.name.trim() && i.start);
    if (chosen.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, items: chosen }),
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

  return (
    <main className="shell">
      <h1>Syllabus Planner</h1>
      <p className="muted">Syllabus and Brightspace in, Notion Student Planner out.</p>

      {error && <p className="warn">{error}</p>}

      {step === "upload" && (
        <>
          <section className="card stack">
            <h2>1. Course and semester</h2>
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
            <label className="inline">
              <input
                type="checkbox"
                checked={useFeed && feedConfigured}
                disabled={!feedConfigured}
                onChange={(e) => setUseFeed(e.target.checked)}
              />
              Also pull exact due dates from my Brightspace calendar
              {!feedConfigured && <span className="small muted" style={{ margin: 0 }}>(feed link not set up)</span>}
            </label>
            <label>
              Anything the AI should know? (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example: exams are always on Wednesdays"
              />
            </label>
          </section>

          <button
            className="primary"
            onClick={extract}
            disabled={busy || !courseId || !semesterStart || !semesterEnd || (!file && !(useFeed && feedConfigured))}
          >
            {busy ? "Reading the syllabus... (about 20 seconds)" : "Find assignments and exams"}
          </button>
        </>
      )}

      {step === "review" && (
        <>
          <section className="card">
            <div className="toolbar">
              <div>
                <h2 style={{ margin: 0 }}>Review for {course?.name}</h2>
                {stats && (
                  <div className="small muted" style={{ margin: 0 }}>
                    {items.length} found, {stats.feedEvents} Brightspace events checked, {stats.existing} already in Notion
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
            <button className="primary" onClick={send} disabled={busy || selectedCount === 0}>
              {busy ? "Adding to Notion..." : `Add ${selectedCount} to Notion`}
            </button>
          </div>
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
