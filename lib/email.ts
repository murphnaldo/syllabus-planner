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

const appUrl = () => (process.env.APP_URL || "https://syllabuddyhq.vercel.app").replace(/\/$/, "");
const fromAddress = () => process.env.EMAIL_FROM || `SyllaBuddy <${process.env.SMTP_USER}>`;
const contact = () => process.env.CONTACT_EMAIL || process.env.SMTP_USER || "";

export async function sendAccessCode(to: string, code: string, runLimit: number): Promise<void> {
  const link = `${appUrl()}/login?code=${encodeURIComponent(code)}`;
  const text = [
    "Hi,",
    "",
    `Here's your SyllaBuddy access code: ${code}`,
    "",
    `Sign in here: ${link}`,
    "",
    `You get ${runLimit} syllabus uploads each semester. Each upload turns one syllabus into a calendar file you can import into Google Calendar, Apple Calendar, or Outlook.`,
    "",
    "Keep this email. If you lose your code, request it again with the same email address and you'll get the same one.",
    "",
    "Found this in Junk or Spam? Mark it \"Not junk\" (or add this address to your contacts) so future SyllaBuddy emails reach your inbox.",
    "",
    contact() ? `Questions or need more uploads? Reply to this email or write to ${contact()}.` : "",
    "",
    "SyllaBuddy",
  ].join("\n");

  const html = `
  <div style="font-family:Inter,Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111827">
    <div style="margin:0 0 18px"><span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:9px;background:#16a34a;color:#fff;font-weight:700;margin-right:8px">S</span><b style="font-size:18px;vertical-align:middle">SyllaBuddy</b></div>
    <h2 style="margin:0 0 12px">Your SyllaBuddy code</h2>
    <p style="margin:0 0 16px">Use this code to sign in:</p>
    <p style="font-size:26px;font-weight:bold;letter-spacing:2px;background:#dcfce7;color:#166534;border-radius:10px;padding:14px 18px;margin:0 0 18px;text-align:center">${code}</p>
    <p style="margin:0 0 22px"><a href="${link}" style="background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block">Sign in to SyllaBuddy</a></p>
    <p style="margin:0 0 12px">You get <b>${runLimit} syllabus uploads</b> each semester. Each one turns a syllabus into a calendar file for Google Calendar, Apple Calendar, or Outlook.</p>
    <p style="margin:0 0 12px;color:#6b7280">Keep this email. If you lose your code, request it again with the same email and you'll get the same one.</p>
    <p style="margin:0 0 12px;color:#6b7280">Found this in Junk or Spam? Mark it <b>Not junk</b> (or add this address to your contacts) so future SyllaBuddy emails reach your inbox.</p>
    ${contact() ? `<p style="margin:0;color:#6b7280">Questions or need more uploads? Reply to this email.</p>` : ""}
  </div>`;

  await transport().sendMail({
    from: fromAddress(),
    to,
    replyTo: contact() || undefined,
    subject: `Your SyllaBuddy code: ${code}`,
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
    subject: `SyllaBuddy: ${studentEmail} asked for access`,
    text: `${studentEmail} asked for a SyllaBuddy code.\n\nApprove or decline: ${appUrl()}/admin`,
  });
}
