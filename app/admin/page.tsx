"use client";

import { useEffect, useMemo, useState } from "react";

type Student = {
  email: string;
  code: string;
  status: "pending" | "active" | "blocked";
  run_limit: number;
  used: number;
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
    };
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students ?? []).filter(
      (s) => (show === "all" || s.status === show) && (!q || s.email.includes(q))
    );
  }, [data, query, show]);

  function downloadCsv() {
    const header = "email,status,used,limit,joined,last_used";
    const lines = (data?.students ?? []).map((s) =>
      [s.email, s.status, s.used, s.run_limit, s.created_at.slice(0, 10), s.last_used_at?.slice(0, 10) ?? ""].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `syllabus-planner-students-${data?.term}.csv`;
    a.click();
  }

  return (
    <main className="shell">
      <div className="toolbar">
        <div>
          <h1>Students</h1>
          <p className="muted" style={{ margin: 0 }}>
            {data ? `${data.term.replace("-", " ")} · sign-ups are ${data.mode}` : "Loading..."}
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
            <div className="stat"><b>{stats.maxedOut}</b><span>used all their uploads</span></div>
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
              <input type="text" placeholder="Search email" value={query} onChange={(e) => setQuery(e.target.value)} />
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
