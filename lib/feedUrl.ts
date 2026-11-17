/**
 * Only accept real course-calendar feed links, so the server can't be pointed anywhere else.
 * - Brightspace (D2L): https://<school>/d2l/le/calendar/feed/user/feed.ics?token=...
 * - Canvas: https://<school>/feeds/calendars/user_<id>.ics
 * - Blackboard Learn: https://<school>/webapps/calendar/calendarFeed/<id>/learn.ics
 */
export function feedKind(url: string): "brightspace" | "canvas" | "blackboard" | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (/\/d2l\/le\/calendar\/feed\//i.test(u.pathname)) return "brightspace";
    if (/^\/feeds\/calendars\/user_[A-Za-z0-9]+\.ics$/i.test(u.pathname)) return "canvas";
    if (/^\/webapps\/calendar\/calendarFeed\/[A-Za-z0-9]+\/learn\.ics$/i.test(u.pathname)) return "blackboard";
    return null;
  } catch {
    return null;
  }
}

export const isFeedUrl = (url: string) => feedKind(url) !== null;
