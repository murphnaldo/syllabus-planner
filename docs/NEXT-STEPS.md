# Syllabuddy: next steps

## Now: go live (about 20 minutes)

Done already: database tables, approval mode, any .edu email, 5 uploads, daily cap, Gmail server settings, the Syllabuddy look.

1. **Gmail for the app.** Create it ("For my personal use"), turn on 2-Step Verification, make an App Password.
2. **Vercel keys (you enter these):** `SUPABASE_SECRET_KEY` and `SMTP_PASS`, as Sensitive.
3. **Tell Claude the Gmail address** and where alerts should go. Claude adds `SMTP_USER`, `EMAIL_FROM` ("Syllabuddy <address>"), and `CONTACT_EMAIL`.
4. **Merge the pull request.** Vercel puts it live in about a minute.
5. **Live test:** request a code with your @uakron.edu email, approve yourself on `/admin`, check the email lands in your inbox (not spam), sign in, run one syllabus.
6. **Set a monthly spending limit** in the Anthropic console as a hard backstop.

## Week 1: friends test it (approval mode)

- Invite 5 to 10 friends, including at least one at Kent State to try a Canvas calendar link.
- Message to send them:

  > I built a free tool called Syllabuddy that turns a syllabus into calendar events (Google, Apple, or Outlook) in about a minute. Want to try it? Go to syllabus-planner-nine.vercel.app, enter your college email, and I'll approve you. Tell me anything that's confusing or wrong.

- Ask each one: Was anything confusing? Were any dates wrong? Would you tell a friend?
- After a few real runs, check console.anthropic.com > Usage for the real cost per upload and update `COST_PER_RUN` in Vercel.

## Before a wider launch

- **A real web address.** syllabuddy.com, .app, or .co is about $10 to $20 a year (Vercel can buy and connect it). It looks far more trustworthy than a vercel.app link, and you'd update `APP_URL`.
- **Feedback button** in the app so students can report a wrong date in one click. (Claude can build this.)
- **Privacy note page:** what's stored (email and upload counts only), what isn't (syllabi), and how to get removed. Students and advisors will ask.
- **Logo and favicon** so the browser tab shows the green S.
- Switch `SIGNUP_MODE` to `open` once costs look predictable.

## Growing it

- **SISTA launch:** demo it at a meeting, then ask members to share it with their classes in the first week of spring semester (syllabus week is when it matters most).
- **Timing:** the big moments are the first two weeks of each semester. Plan announcements for early January and late August.
- **Numbers to track on `/admin`:** students, schools, uploads, cost. These are what a sponsor (SISTA, the College of Business, student success office) wants to see if you ask them to cover the AI bill.
- **Résumé and LinkedIn:** "Built and launched Syllabuddy, an AI tool used by N students at M universities." Update the numbers as it grows.

## Later ideas

- Sign in with Google or Microsoft school accounts instead of codes.
- Let students subscribe to a live calendar link instead of downloading a file, so later fixes update automatically.
- A "bring your own API key" option for unlimited uploads.
- Open source the code on GitHub once it's stable.
