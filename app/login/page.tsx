"use client";

import { useEffect, useState } from "react";

type Mode = "open" | "approval" | "closed";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [domains, setDomains] = useState<string[]>([]);

  // Get-a-code form
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<"sent" | "pending" | null>(null);
  const [signupError, setSignupError] = useState("");

  // Sign-in form
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // The emailed link is /login?code=ZIP-XXXX-XXXX
    const fromLink = new URLSearchParams(window.location.search).get("code");
    if (fromLink) setCode(fromLink);
    fetch("/api/signup")
      .then((r) => r.json())
      .then((d) => {
        setMode(d.mode ?? "closed");
        setDomains(d.domains ?? []);
      })
      .catch(() => setMode("closed"));
  }, []);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSignupError("");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, website }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok && data.ok) setSent(data.status);
    else setSignupError(data.error || "Could not send your code.");
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: code }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not sign in.");
    }
  }

  const domainHint = domains.length ? domains.map((d) => "@" + d).join(" or ") : "school";

  return (
    <main className="shell landing">
      <header className="hero">
        <h1>Syllabus Planner</h1>
        <p className="lead">
          Upload a syllabus. Get every assignment, quiz, and exam on your calendar in about a minute.
        </p>
      </header>

      <ol className="steps">
        <li>
          <b>Upload your syllabus</b>
          <span>The PDF from Brightspace. Add your Brightspace calendar link for exact due dates.</span>
        </li>
        <li>
          <b>Review the list</b>
          <span>AI pulls out every graded item and date. Fix anything before you save.</span>
        </li>
        <li>
          <b>Add it to your calendar</b>
          <span>Download one file and import it into Google Calendar, Apple Calendar, or Outlook.</span>
        </li>
      </ol>

      <div className="auth-grid">
        {mode && mode !== "closed" && (
          <section className="card stack">
            <h2>New here? Get a free code</h2>
            {sent === "sent" ? (
              <p className="ok">
                Check your email. We sent your code to {email}. It can take a minute, and it may land in spam.
              </p>
            ) : sent === "pending" ? (
              <p className="ok">Thanks! Your request is in. You'll get your code by email once it's approved.</p>
            ) : (
              <form onSubmit={requestCode} className="stack">
                <label>
                  School email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`you${domains[0] ? "@" + domains[0] : "@school.edu"}`}
                    autoComplete="email"
                    required
                  />
                </label>
                <input
                  className="hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  name="website"
                />
                <button className="primary" disabled={sending || !email}>
                  {sending ? "Sending..." : mode === "approval" ? "Request a code" : "Email me a code"}
                </button>
                <p className="muted small">
                  Free for students with a {domainHint} email: 5 syllabus uploads each semester.
                  {mode === "approval" && " Requests are approved by hand, usually within a day."}
                </p>
                {signupError && <p className="error">{signupError}</p>}
              </form>
            )}
          </section>
        )}

        <section className="card stack">
          <h2>Have a code?</h2>
          <form onSubmit={signIn} className="stack">
            <label>
              Access code
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ZIP-XXXX-XXXX"
                autoFocus={Boolean(code)}
              />
            </label>
            <button className={mode === "closed" ? "primary" : ""} disabled={busy || !code}>
              {busy ? "Checking..." : "Sign in"}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
          {mode === "closed" && (
            <p className="muted small">New sign-ups are paused right now. If a friend shared a code with you, enter it here.</p>
          )}
        </section>
      </div>

      <p className="muted small footnote">
        Your syllabus is only used to build your list. This app doesn't save it. Built by a University of Akron student.
      </p>
    </main>
  );
}
