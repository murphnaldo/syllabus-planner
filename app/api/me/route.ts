import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkInvite } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.role === "owner") {
    return NextResponse.json({ role: "owner", feedConfigured: Boolean(process.env.BRIGHTSPACE_ICS_URL) });
  }
  const invite = await checkInvite(session.code).catch(() => null);
  if (!invite) return NextResponse.json({ error: "This invite code is no longer active." }, { status: 401 });
  return NextResponse.json({
    role: "guest",
    name: invite.name,
    used: invite.used,
    limit: invite.limit,
  });
}
