// Shared by middleware (edge) and route handlers (node): uses Web Crypto only.
export const SESSION_COOKIE = "sp_session";

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`syllabus-planner:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password || !cookieValue) return false;
  return cookieValue === (await sessionToken(password));
}
