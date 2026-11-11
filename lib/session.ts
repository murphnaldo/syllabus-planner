import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession, type Session } from "./auth";
import { isFeedUrl } from "./feedUrl";

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * The owner's feed comes from the server setting. Friends paste their own link,
 * which is kept in their browser and sent with each request, never stored.
 */
export async function getFeedUrl(_req: Request, provided?: string | null): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const url = provided?.trim() || (session.role === "owner" ? process.env.BRIGHTSPACE_ICS_URL ?? "" : "");
  if (!url) return null;
  if (!isFeedUrl(url)) throw new Error("That doesn't look like a Brightspace calendar feed link.");
  return url;
}
