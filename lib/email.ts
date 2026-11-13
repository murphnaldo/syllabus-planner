import nodemailer from "nodemailer";

// Sends email over SMTP. Works with a Gmail account (app password) or any provider
// with SMTP, like Resend or Brevo. See README "Student sign-ups" for setup.

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const appUrl = () => (process.env.APP_URL || "https://syllabus-planner-nine.vercel.app").replace(/\/$/, "");
const fromAddress = () => process.env.EMAIL_FROM || `Syllabus Planner <${process.env.SMTP_USER}>`;
const contact = () => process.env.CONTACT_EMAIL || process.env.SMTP_USER || "";

export async function sendAccessCode(to: string, code: string, runLimit: number): Promise<void> {
  const link = `${appUrl()}/login?code=${encodeURIComponent(code)}`;
  const text = [
    "Hi,",
    "",
    `Here's your Syllabus Planner access code: ${code}`,
    "",
    `Sign in here: ${link}`,
    "",
    `You get ${runLimit} syllabus uploads each semester. Each upload turns one syllabus into a calendar file you can import into Google Calendar, Apple Calendar, or Outlook.`,
    "",
    "Keep this email. If you lose your code, request it again with the same email address and you'll get the same one.",
    "",
    contact() ? `Questions or need more uploads? Reply to this email or write to ${contact()}.` : "",
    "",
    "Syllabus Planner",
  ].join("\n");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1d2433">
    <h2 style="margin:0 0 12px">Your Syllabus Planner code</h2>
    <p style="margin:0 0 16px">Use this code to sign in:</p>
    <p style="font-size:26px;font-weight:bold;letter-spacing:2px;background:#f1f3f8;border-radius:8px;padding:14px 18px;margin:0 0 18px;text-align:center">${code}</p>
    <p style="margin:0 0 22px"><a href="${link}" style="background:#5b7cfa;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">Sign in to Syllabus Planner</a></p>
    <p style="margin:0 0 12px">You get <b>${runLimit} syllabus uploads</b> each semester. Each one turns a syllabus into a calendar file for Google Calendar, Apple Calendar, or Outlook.</p>
    <p style="margin:0 0 12px;color:#5a6275">Keep this email. If you lose your code, request it again with the same email and you'll get the same one.</p>
    ${contact() ? `<p style="margin:0;color:#5a6275">Questions or need more uploads? Reply to this email.</p>` : ""}
  </div>`;

  await transport().sendMail({
    from: fromAddress(),
    to,
    replyTo: contact() || undefined,
    subject: `Your Syllabus Planner code: ${code}`,
    text,
    html,
  });
}

/** Lets the owner know someone is waiting for approval. Best effort. */
export async function notifyOwnerOfRequest(studentEmail: string): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL || contact();
  if (!to) return;
  await transport().sendMail({
    from: fromAddress(),
    to,
    subject: `Syllabus Planner: ${studentEmail} asked for access`,
    text: `${studentEmail} asked for a Syllabus Planner code.\n\nApprove or decline: ${appUrl()}/admin`,
  });
}
