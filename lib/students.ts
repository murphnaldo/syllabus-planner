import { currentTerm } from "./supabase";

// Student self-signups live in the student_access and student_runs tables.
// Unlike invite codes, these tables can only be reached with the SECRET key,
// so nobody can mint codes or read emails from the browser.
const URL = process.env.SUPABASE_URL || "https://flqrbluoyueylutkuheb.supabase.co";

function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set on the server.");
  return key;
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = secretKey();
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Database error ${res.status}`);
  return data as T;
}

export type StudentStatus = "pending" | "active" | "blocked";

export type Student = {
  email: string;
  code: string;
  status: StudentStatus;
  run_limit: number;
  created_at: string;
  approved_at: string | null;
  last_sent_at: string | null;
  sends_day: string | null;
  sends_today: number;
  last_used_at: string | null;
  note: string | null;
};

export type StudentWithUsage = Student & { used: number };

/** Student codes look like ZIP-7K2Q-M4XD so they're easy to tell apart from friend invite codes. */
export const isStudentCode = (code: string) => /^ZIP-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code);

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
export function newStudentCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `ZIP-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export const defaultRunLimit = () => Math.max(0, Number(process.env.STUDENT_RUN_LIMIT || 5));

export async function getStudentByEmail(email: string): Promise<Student | null> {
  const rows = await rest<Student[]>(`student_access?email=eq.${encodeURIComponent(email)}&select=*`);
  return rows[0] ?? null;
}

export async function getStudentByCode(code: string): Promise<Student | null> {
  const rows = await rest<Student[]>(`student_access?code=eq.${encodeURIComponent(code.toUpperCase())}&select=*`);
  return rows[0] ?? null;
}

export async function createStudent(email: string, status: StudentStatus): Promise<Student> {
  // Retry on the (very unlikely) chance of a duplicate code
  for (let i = 0; i < 3; i++) {
    try {
      const rows = await rest<Student[]>("student_access", {
        method: "POST",
        body: JSON.stringify({
          email,
          code: newStudentCode(),
          status,
          run_limit: defaultRunLimit(),
          approved_at: status === "active" ? new Date().toISOString() : null,
        }),
      });
      return rows[0];
    } catch (e) {
      if (i === 2 || !String(e).includes("duplicate")) throw e;
      const existing = await getStudentByEmail(email);
      if (existing) return existing;
    }
  }
  throw new Error("Could not create the student code.");
}

export async function updateStudent(email: string, patch: Partial<Student>): Promise<Student> {
  const rows = await rest<Student[]>(`student_access?email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return rows[0];
}

export async function countNewStudentsToday(): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const res = await fetch(
    `${URL}/rest/v1/student_access?created_at=gte.${encodeURIComponent(since.toISOString())}&select=email`,
    {
      method: "HEAD",
      headers: { apikey: secretKey(), Authorization: `Bearer ${secretKey()}`, Prefer: "count=exact" },
      cache: "no-store",
    }
  );
  const range = res.headers.get("content-range") ?? "";
  return Number(range.split("/")[1] || 0);
}

export async function runsUsed(email: string, term = currentTerm()): Promise<number> {
  const rows = await rest<{ used: number }[]>(
    `student_runs?email=eq.${encodeURIComponent(email)}&term=eq.${term}&select=used`
  );
  return rows[0]?.used ?? 0;
}

export async function recordStudentRun(code: string, term = currentTerm()): Promise<number> {
  return rest<number>("rpc/record_student_run", {
    method: "POST",
    body: JSON.stringify({ p_code: code.toUpperCase(), p_term: term }),
  });
}

export async function listStudents(term = currentTerm()): Promise<StudentWithUsage[]> {
  const [students, runs] = await Promise.all([
    rest<Student[]>("student_access?select=*&order=created_at.desc"),
    rest<{ email: string; used: number }[]>(`student_runs?term=eq.${term}&select=email,used`),
  ]);
  const used = new Map(runs.map((r) => [r.email, r.used]));
  return students.map((s) => ({ ...s, used: used.get(s.email) ?? 0 }));
}

/** Allowed school email domains, e.g. "uakron.edu,zips.uakron.edu". Subdomains count too. */
export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "uakron.edu")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.length > 200) return null;
  return email;
}

export function emailAllowed(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return allowedDomains().some((d) => domain === d || domain.endsWith(`.${d}`));
}

export type SignupMode = "open" | "approval" | "closed";
export function signupMode(): SignupMode {
  const m = (process.env.SIGNUP_MODE || "open").toLowerCase();
  return m === "approval" || m === "closed" ? m : "open";
}

/** Friendly first name from an email: "jdoe12@uakron.edu" -> "jdoe12" */
export const displayName = (email: string) => email.split("@")[0];
