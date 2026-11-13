import { NextResponse } from "next/server";
import { emailConfigured, notifyOwnerOfRequest, sendAccessCode } from "@/lib/email";
import {
  allowedDomains,
  countNewStudentsToday,
  createStudent,
  emailAllowed,
  getStudentByEmail,
  normalizeEmail,
  signupMode,
  updateStudent,
} from "@/lib/students";

export const dynamic = "force-dynamic";

const RESEND_COOLDOWN_MS = 60_000; // one email per minute per address
const MAX_SENDS_PER_DAY = 5; // per address
const dailyCap = () => Number(process.env.SIGNUP_DAILY_CAP || 100); // new students per day, protects your API bill

type Reply = { ok: true; status: "sent" | "pending" } | { ok: false; error: string };
const reply = (body: Reply, status = 200) => NextResponse.json(body, { status });

/** GET: what the sign-in page should show (open, approval, or closed). */
export async function GET() {
  return NextResponse.json({
    mode: emailConfigured() ? signupMode() : "closed",
    domains: allowedDomains(),
  });
}

/** POST { email }: email the student their code (creating it on first request). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; website?: string };
  if (body.website) return reply({ ok: true, status: "sent" }); // honeypot: bots fill hidden fields

  const mode = signupMode();
  if (mode === "closed" || !emailConfigured()) {
    return reply({ ok: false, error: "Sign-ups are closed right now." }, 403);
  }

  const email = normalizeEmail(body.email ?? "");
  if (!email) return reply({ ok: false, error: "Enter a valid email address." }, 400);
  if (!emailAllowed(email)) {
    return reply({ ok: false, error: `Use your school email (${allowedDomains().map((d) => "@" + d).join(" or ")}).` }, 400);
  }

  try {
    let student = await getStudentByEmail(email);

    if (!student) {
      if ((await countNewStudentsToday()) >= dailyCap()) {
        return reply({ ok: false, error: "We've hit today's sign-up limit. Please try again tomorrow." }, 429);
      }
      student = await createStudent(email, mode === "approval" ? "pending" : "active");
      if (student.status === "pending") {
        await notifyOwnerOfRequest(email).catch(() => {});
        return reply({ ok: true, status: "pending" });
      }
    }

    if (student.status === "blocked") {
      return reply({ ok: false, error: "This email can't sign up. Contact the site owner if that's a mistake." }, 403);
    }
    if (student.status === "pending") return reply({ ok: true, status: "pending" });

    // Throttle repeat requests for the same address
    const today = new Date().toISOString().slice(0, 10);
    const sendsToday = student.sends_day === today ? student.sends_today : 0;
    const last = student.last_sent_at ? Date.parse(student.last_sent_at) : 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
      return reply({ ok: false, error: "We just sent your code. Check your inbox (and spam), or try again in a minute." }, 429);
    }
    if (sendsToday >= MAX_SENDS_PER_DAY) {
      return reply({ ok: false, error: "Too many requests for this email today. Check your inbox and spam folder." }, 429);
    }

    await sendAccessCode(email, student.code, student.run_limit);
    await updateStudent(email, {
      last_sent_at: new Date().toISOString(),
      sends_day: today,
      sends_today: sendsToday + 1,
    });
    return reply({ ok: true, status: "sent" });
  } catch (e) {
    console.error("signup failed", e);
    return reply({ ok: false, error: "Something went wrong sending your code. Try again in a few minutes." }, 500);
  }
}
