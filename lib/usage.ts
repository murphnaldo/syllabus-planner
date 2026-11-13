// One place to check and count runs for anyone who isn't the owner:
// friends with invite codes (invite_codes table) and students who signed
// up with their school email (student_access table).
import { checkInvite, recordRun } from "./supabase";
import { displayName, getStudentByCode, isStudentCode, recordStudentRun, runsUsed } from "./students";

export type GuestStatus = { name: string; used: number; limit: number; kind: "invite" | "student" };

export async function guestStatus(code: string): Promise<GuestStatus | null> {
  if (isStudentCode(code)) {
    const s = await getStudentByCode(code);
    if (!s || s.status !== "active") return null;
    return { name: displayName(s.email), used: await runsUsed(s.email), limit: s.run_limit, kind: "student" };
  }
  const invite = await checkInvite(code);
  return invite ? { ...invite, kind: "invite" } : null;
}

export async function recordGuestRun(code: string): Promise<number> {
  return isStudentCode(code) ? recordStudentRun(code) : recordRun(code);
}

export function outOfRunsMessage(limit: number): string {
  const contact = process.env.CONTACT_EMAIL;
  return `You've used all ${limit} uploads for this semester.` + (contact ? ` Need more? Email ${contact}.` : "");
}
