import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, type Session } from "@/lib/auth";
import { guestStatus } from "@/lib/usage";

/** One box: the owner's password, or a friend's invite code. */
export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const entered = (password ?? "").trim();
  const ownerPassword = process.env.APP_PASSWORD;
  if (!ownerPassword) {
    return NextResponse.json({ error: "APP_PASSWORD is not set on the server." }, { status: 500 });
  }

  let session: Session | null = null;
  if (entered && entered === ownerPassword) {
    session = { role: "owner" };
  } else if (/^[A-Za-z0-9-]{4,32}$/.test(entered)) {
    try {
      const invite = await guestStatus(entered);
      if (invite) session = { role: "guest", code: entered.toUpperCase(), name: invite.name };
    } catch {
      return NextResponse.json({ error: "Could not check that code right now. Try again." }, { status: 503 });
    }
  }

  if (!session) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "That code didn't work. Check it against your email, or request it again below." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: session.role });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 120,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
