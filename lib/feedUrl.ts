/** Only accept real Brightspace calendar feed links, so the server can't be pointed anywhere else. */
export function isFeedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /\/d2l\/le\/calendar\/feed\//i.test(u.pathname);
  } catch {
    return false;
  }
}
