// Signed session cookie. Works in middleware (edge) and route handlers (node): Web Crypto only.
export const SESSION_COOKIE = "sp_session";

export type Session = { role: "owner" } | { role: "guest"; code: string; name: string };

function secret(): string {
  return process.env.SESSION_SECRET || `sp-session:${process.env.APP_PASSWORD ?? ""}`;
}

const enc = new TextEncoder();

function toB64Url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return decodeURIComponent(escape(atob(pad)));
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(session: Session): Promise<string> {
  const payload = toB64Url(JSON.stringify(session));
  return `${payload}.${await sign(payload)}`;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token || !process.env.APP_PASSWORD) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if ((await sign(payload)) !== sig) return null;
  try {
    const s = JSON.parse(fromB64Url(payload));
    if (s?.role === "owner") return { role: "owner" };
    if (s?.role === "guest" && typeof s.code === "string") return { role: "guest", code: s.code, name: String(s.name ?? "") };
  } catch {}
  return null;
}
