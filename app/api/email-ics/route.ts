import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { emailConfigured, sendCalendarFile } from "@/lib/email";
import { getStudentByCode, isStudentCode, updateStudent } from "@/lib/students";

export const dynamic = "force-dynamic";

const MAX_PER_DAY = 10;
const MAX_BYTES = 200_000;

/** POST { fileName, ics, courseLabel }: emails the calendar file to the signed-in student's own address. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "guest" || !isStudentCode(session.code)) {
    return NextResponse.json({ error: "Only students who signed up with their email can use this." }, { status: 403 });
  }
  if (!emailConfigured()) return NextResponse.json({ error: "Email isn't set up." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { fileName?: string; ics?: string; courseLabel?: string };
  const ics = body.ics ?? "";
  if (!ics.startsWith("BEGIN:VCALENDAR") || ics.length > MAX_BYTES) {
    return NextResponse.json({ error: "That calendar file doesn't look right." }, { status: 400 });
  }
  const fileName = (body.fileName || "syllabuddy.ics").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
  const courseLabel = (body.courseLabel || "").slice(0, 80);

  const student = await getStudentByCode(session.code);
  if (!student || student.status !== "active") {
    return NextResponse.json({ error: "This code is no longer active." }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const sentToday = student.ics_sent_day === today ? student.ics_sent_today ?? 0 : 0;
  if (sentToday >= MAX_PER_DAY) {
    return NextResponse.json({ error: "You've emailed yourself a lot of files today. Try again tomorrow." }, { status: 429 });
  }

  try {
    await sendCalendarFile(student.email, fileName, ics, courseLabel);
    await updateStudent(student.email, { ics_sent_day: today, ics_sent_today: sentToday + 1 });
    return NextResponse.json({ ok: true, email: student.email });
  } catch (e) {
    console.error("email-ics failed", e);
    return NextResponse.json({ error: "Couldn't send the email. Try downloading instead." }, { status: 500 });
  }
}
