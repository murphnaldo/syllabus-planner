// Invite codes and usage counts live in the "syllabus-planner" Supabase project.
// The tables are locked down (row level security, no policies); the public key can
// only call the two functions below. The publishable key is safe to ship.
const URL = process.env.SUPABASE_URL || "https://flqrbluoyueylutkuheb.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_clj8Ihh5IPDAroFK5FbToQ_eXIYU1EY";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Database error ${res.status}`);
  return data as T;
}

/** "fall-2026", "spring-2027", "summer-2027": limits reset each term */
export function currentTerm(now = new Date()): string {
  const m = now.getMonth() + 1;
  const season = m <= 5 ? "spring" : m <= 7 ? "summer" : "fall";
  return `${season}-${now.getFullYear()}`;
}

export type InviteStatus = { name: string; limit: number; used: number };

export async function checkInvite(code: string): Promise<InviteStatus | null> {
  const rows = await rpc<{ name: string; run_limit: number; used: number }[]>("check_invite", {
    p_code: code,
    p_term: currentTerm(),
  });
  const row = rows?.[0];
  return row ? { name: row.name, limit: row.run_limit, used: row.used } : null;
}

export async function recordRun(code: string): Promise<number> {
  return rpc<number>("record_run", { p_code: code, p_term: currentTerm() });
}
