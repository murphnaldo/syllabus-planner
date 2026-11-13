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
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session.role !== "owner" && OWNER_ONLY.some((p) => pathname.startsWith(p))) {
    if (!pathname.startsWith("/api/")) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.json({ error: "Not available with an access code" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
