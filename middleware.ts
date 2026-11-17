import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

// Routes only the owner (password) can use; friends with invite codes get the rest
const OWNER_ONLY = ["/api/courses", "/api/send", "/api/admin", "/admin"];
// Pages and APIs anyone can reach without signing in
const PUBLIC = ["/login", "/api/login", "/api/signup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    return NextResponse.redirect(loginUrl(req, pathname));
  }
  if (session.role !== "owner" && OWNER_ONLY.some((p) => pathname.startsWith(p))) {
    // Signed in with a student or friend code: offer the owner sign-in, then come back here
    if (!pathname.startsWith("/api/")) return NextResponse.redirect(loginUrl(req, pathname));
    return NextResponse.json({ error: "Not available with an access code" }, { status: 403 });
  }
  return NextResponse.next();
}

/** /login?next=/admin, so signing in returns you to the page you wanted. */
function loginUrl(req: NextRequest, pathname: string): URL {
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return url;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
