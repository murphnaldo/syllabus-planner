# SyllaBuddy: road to the spring 2027 launch

**Launch day: Monday, January 11, 2027** (first day of spring classes at UA). Fall classes end December 6 and finals run December 7 to 13.

Live now at **https://syllabuddyhq.vercel.app** (the old syllabus-planner-nine.vercel.app link still works).

## Done
- Student sign-up with any .edu email, approval mode, 5 uploads per semester, daily cap
- Code emails from SyllaBuddy (syllabuddyhq@gmail.com), with a Junk-folder tip on the site and in the email
- Admin page: students, schools, uploads, estimated cost, approve/block/resend/+5
- Brightspace, Canvas, and Blackboard calendar links
- SyllaBuddy name and Clean Campus look
- Uploads reset automatically: January 1 starts the spring count

## Now to Sunday, December 6: quiet friend test
- [ ] Invite 5 to 10 friends, including at least one at Kent State to try a Canvas calendar link. Fall syllabi are fine; you're testing the app, not the dates.
- [ ] Message to send:

  > I built a free tool called SyllaBuddy that turns a syllabus into calendar events (Google, Apple, or Outlook) in about a minute. Want to try it before I launch it in January? Go to syllabuddyhq.vercel.app, enter your college email, and I'll approve you. The code email might land in Junk. Tell me anything that's confusing or wrong.

- [ ] Ask each one: Was anything confusing? Were any dates wrong? Would you tell a friend?
- [ ] After a few real runs, check console.anthropic.com > Usage for the real cost per upload, and update `COST_PER_RUN` in Vercel.
- [ ] Add syllabuddyhq@gmail.com to your phone's Gmail app so you see access requests quickly.

## December 7 to 13: finals
Nothing on SyllaBuddy.

## December 14 to 31: build for launch (mostly Claude, while you're on break)
- [ ] **Buy syllabuddyhq.com** ($12.03 a year through Vercel; your payment, your call). Connect it and update `APP_URL`.
- [ ] **Branded email** like `codes@syllabuddyhq.com` through an email service, with the domain verified. This is the real fix for codes landing in Junk.
- [ ] **"Report a wrong date" button** so students can flag mistakes in one click.
- [ ] **Privacy page:** what's stored (email, upload counts), what isn't (syllabi), how to be removed.
- [ ] **Browser tab icon** (the green S) and a full check on phones, since most students will use it there.
- [ ] Use your friends' feedback to fix anything confusing.

## January 1 to 10: launch prep
- [ ] Run your own spring syllabi through it as professors post them.
- [ ] Set a monthly spending limit in the Anthropic console.
- [ ] Decide: stay in approval mode, or switch `SIGNUP_MODE` to `open` (one setting in Vercel).
- [ ] Announcements ready: SISTA post and group chats, maybe a flyer and a 30-second screen recording of a syllabus turning into calendar events.
- [ ] Ask SISTA members to share it with their classes on day one.

## January 11 to 25: launch
- [ ] Post announcements on January 11. The first two weeks are when everyone reads syllabi.
- [ ] Check the Students page daily: approvals, uploads, cost.
- [ ] Fix problems fast; ask early users for a quick review or quote.

## After launch
- Use the numbers on the Students page (students, schools, uploads, cost) for a sponsor pitch to SISTA, the College of Business, or student success, and for your résumé and LinkedIn: "Built and launched SyllaBuddy, an AI tool used by N students at M universities."
- Later ideas: sign in with school Google/Microsoft accounts, a live calendar subscription instead of a downloaded file, a "bring your own API key" option, open-sourcing the code.
