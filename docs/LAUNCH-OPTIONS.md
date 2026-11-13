# Launching Syllabus Planner campus-wide: options

The goal: easy for students to start, while you keep control of usage because you pay for the AI.

## What's built on this branch

Students go to the site, type their `@uakron.edu` email, and get a personal code by email (`ZIP-7K2Q-M4XD`) with a sign-in link. Each code gets 5 uploads per semester. You see everyone on `/admin`. Friend invite codes like Bri's keep working.

You choose how open it is with one setting, `SIGNUP_MODE`, and you can switch anytime in Vercel without changing code.

| | **A. Open sign-up** (`open`) | **B. Approval** (`approval`) | **C. Closed** (`closed`) |
|---|---|---|---|
| Student experience | Email in, code in about a minute | Request, wait for you | Need a code from you |
| Your work | None | Click Approve on `/admin` | Create codes by hand |
| Control over cost | Daily cap + 5 uploads each | Total control | Total control |
| Best for | Growing fast | First few weeks, testing | Pausing if costs spike |

**Recommendation:** start in **B (approval)** for the first week or two while you learn real costs and catch problems, then switch to **A (open)** before you promote it widely. Flip to **C** anytime if something goes wrong.

## What it costs you

Each upload is one AI call. Check your real cost per upload at console.anthropic.com > Usage after a few runs, then set `COST_PER_RUN` so the `/admin` estimate is accurate.

Worst case at 5 uploads per student: `students × 5 × cost per upload`. At $0.10 per upload, 200 students who use every upload is $100 a semester. Most students won't use all 5, but plan for it. Also set a monthly spending limit in the Anthropic console as a hard backstop.

Email is free with a Gmail account (about 500 emails a day).

## Other options (not built yet)

### D. Open source on GitHub
Make the repo public with a license (MIT is common) so anyone can read the code and run their own copy with their own API key. Good for your portfolio and for other schools. Your hosted site stays the easy option for UA students, and your keys never go in the repo (they're in Vercel).
- Before making it public: the Notion database IDs in `.env.example` are yours. They aren't secret, but swap them for blanks.
- **Your decision:** public repo or not. I didn't change it.

### E. "Bring your own key" for power users
Students who want more than 5 uploads paste their own Anthropic API key and get unlimited uploads at their own cost. Low effort, but most students won't have a key, so this is a nice extra, not the main path.

### F. Get it sponsored
Once it has users, the numbers on `/admin` (students, uploads, cost) are exactly what a sponsor wants to see. SISTA, the College of Business, or the student success office might cover the AI bill. This is how a student tool turns into a campus tool.

### G. Sign in with Google instead of email codes
Since UA email runs on Google or Microsoft, "Sign in with your school account" is one click instead of a code. More setup, and may need IT approval. Worth it later if codes feel clunky.

## Before you promote it

- Run it in approval mode with 10 to 20 friends first.
- Check the emails don't land in spam at UA. Send a few test codes to your own `@uakron.edu` address.
- Don't use the university's logo or call it official. "Built by a UA student" is fine.
- Ask SISTA members to try it and share it. That's your launch team.
