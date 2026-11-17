"use client";

import { useEffect, useMemo, useState } from "react";

type Student = {
  email: string;
  code: string;
  status: "pending" | "active" | "blocked";
  run_limit: number;
  used: number;
  school: string;
  created_at: string;
  last_used_at: string | null;
};

type Data = {
  term: string;
  mode: "open" | "approval" | "closed";
  emailConfigured: boolean;
  costPerRun: number;
  students: Student[];
};

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

export default function AdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "pending" | "active" | "blocked">("all");
  const [school, setSchool] = useState("");

  async function load() {
    const res = await fetch("/api/admin/students");
    const d = await res.json().catch(() => ({}));
    if (res.ok) setData(d);
    else setError(d.error || "Could not load students.");
  }
  useEffect(() => {
    load();
  }, []);

  async function act(email: string, action: string, amount?: number) {
    setBusy(email + action);
    setNotice("");
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action, amount }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setNotice(d.error || "That didn't work.");
    if (action === "approve") {
      setNotice(d.emailed ? `Approved and emailed ${email}.` : `Approved. Email isn't set up, so send them this code yourself: ${d.code}`);
    } else if (action === "resend") setNotice(`Code re-sent to ${email}.`);
    load();
  }

  const stats = useMemo(() => {
    const s = data?.students ?? [];
    const runs = s.reduce((n, x) => n + x.used, 0);
    return {
      total: s.filter((x) => x.status === "active").length,
      pending: s.filter((x) => x.status === "pending").length,
      activeThisTerm: s.filter((x) => x.used > 0).length,
      runs,
      maxedOut: s.filter((x) => x.status === "active" && x.used >= x.run_limit).length,
      cost: runs * (data?.costPerRun ?? 0),
      schools: new Set(s.map((x) => x.school)).size,
    };
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students ?? []).filter(
      (s) => (show === "all" || s.status === show) && (!school || s.school === school) && (!q || s.email.includes(q))
    );
  }, [data, query, show, school]);

  const schools = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of data?.students ?? []) counts.set(s.school, (counts.get(s.school) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  function downloadCsv() {
    const header = "email,school,status,used,limit,joined,last_used";
    const lines = (data?.students ?? []).map((s) =>
      [s.email, s.school, s.status, s.used, s.run_limit, s.created_at.slice(0, 10), s.last_used_at?.slice(0, 10) ?? ""].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `syllabuddy-students-${data?.term}.csv`;
    a.click();
  }

  return (
    <main className="shell">
      <div className="toolbar">
        <div>
          <h1>Students</h1>
          <p className="muted" style={{ margin: 0 }}>
            {data ? `${data.term.replace("-", " ")} · ${{ open: "sign-ups are open", approval: "sign-ups need your approval", closed: "sign-ups are closed" }[data.mode]}` : "Loading..."}
            {data && !data.emailConfigured && " · email isn't set up yet"}
          </p>
        </div>
        <div className="filters">
          <a href="/">
            <button>Back to planner</button>
          </a>
          <button onClick={downloadCsv} disabled={!data?.students.length}>
            Download CSV
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="stats">
            <div className="stat"><b>{stats.total}</b><span>students with access</span></div>
            <div className="stat"><b>{stats.activeThisTerm}</b><span>used it this semester</span></div>
            <div className="stat"><b>{stats.runs}</b><span>uploads this semester</span></div>
            <div className="stat"><b>${stats.cost.toFixed(2)}</b><span>estimated AI cost</span></div>
            <div className="stat"><b>{stats.pending}</b><span>waiting for approval</span></div>
            <div className="stat"><b>{stats.schools}</b><span>{stats.schools === 1 ? "school" : "schools"}</span></div>
          </div>

          <section className="card">
            <div className="toolbar">
              <div className="filters">
                {(["all", "pending", "active", "blocked"] as const).map((f) => (
                  <button key={f} className={show === f ? "primary" : ""} onClick={() => setShow(f)}>
                    {f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="filters">
                <select value={school} onChange={(e) => setSchool(e.target.value)} style={{ width: "auto" }}>
                  <option value="">All schools</option>
                  {schools.map(([name, n]) => (
                    <option key={name} value={name}>{name} ({n})</option>
                  ))}
                </select>
                <input type="text" placeholder="Search email" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            {notice && <p className="warn">{notice}</p>}
            {rows.length === 0 ? (
              <p className="muted">No students here yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="students">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>School</th>
                      <th>Status</th>
                      <th>Uploads</th>
                      <th>Joined</th>
                      <th>Last used</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.email}>
                        <td>{s.email}</td>
                        <td>{s.school}</td>
                        <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                        <td>{s.used} of {s.run_limit}</td>
                        <td>{fmtDate(s.created_at)}</td>
                        <td>{fmtDate(s.last_used_at)}</td>
                        <td className="actions">
                          {s.status === "pending" && (
                            <button className="primary" disabled={!!busy} onClick={() => act(s.email, "approve")}>Approve</button>
                          )}
                          {s.status === "active" && (
                            <>
                              <button disabled={!!busy} onClick={() => act(s.email, "addRuns", 5)}>+5 uploads</button>
                              <button disabled={!!busy || !data.emailConfigured} onClick={() => act(s.email, "resend")}>Resend code</button>
                            </>
                          )}
                          {s.status === "blocked" ? (
                            <button disabled={!!busy} onClick={() => act(s.email, "unblock")}>Unblock</button>
                          ) : (
                            <button disabled={!!busy} onClick={() => act(s.email, "block")}>
                              {s.status === "pending" ? "Decline" : "Block"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
