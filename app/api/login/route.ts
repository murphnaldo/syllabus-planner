import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "APP_PASSWORD is not set on the server." }, { status: 500 });
  }
  if (password !== expected) {
    // Small delay to slow down guessing
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
