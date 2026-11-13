import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { emailConfigured, sendAccessCode } from "@/lib/email";
import { currentTerm } from "@/lib/supabase";
import { getStudentByEmail, listStudents, signupMode, updateStudent } from "@/lib/students";

export const dynamic = "force-dynamic";

async function ownerOnly() {
  const session = await getSession();
  return session?.role === "owner";
}

/** GET: every student with this term's usage. Owner only. */
export async function GET() {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  try {
    const students = await listStudents();
    return NextResponse.json({
      term: currentTerm(),
      mode: signupMode(),
      emailConfigured: emailConfigured(),
      costPerRun: Number(process.env.COST_PER_RUN || 0.1),
      students,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}

type Action = { email: string; action: "approve" | "block" | "unblock" | "addRuns" | "resend"; amount?: number };

/** POST: approve, block, unblock, add runs, or resend a student's code. Owner only. */
export async function POST(req: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const { email, action, amount } = (await req.json().catch(() => ({}))) as Action;
  const student = email ? await getStudentByEmail(email) : null;
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  try {
    switch (action) {
      case "approve": {
        const updated = await updateStudent(email, { status: "active", approved_at: new Date().toISOString() });
        let emailed = false;
        if (emailConfigured()) {
          await sendAccessCode(email, updated.code, updated.run_limit);
          await updateStudent(email, { last_sent_at: new Date().toISOString() });
          emailed = true;
        }
        return NextResponse.json({ ok: true, emailed, code: updated.code });
      }
      case "block":
        await updateStudent(email, { status: "blocked" });
        return NextResponse.json({ ok: true });
      case "unblock":
        await updateStudent(email, { status: "active" });
        return NextResponse.json({ ok: true });
      case "addRuns": {
        const n = Math.max(1, Math.min(50, Math.round(Number(amount) || 5)));
        await updateStudent(email, { run_limit: student.run_limit + n });
        return NextResponse.json({ ok: true });
      }
      case "resend":
        if (!emailConfigured()) return NextResponse.json({ error: "Email isn't set up yet." }, { status: 400 });
        await sendAccessCode(email, student.code, student.run_limit);
        await updateStudent(email, { last_sent_at: new Date().toISOString() });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
