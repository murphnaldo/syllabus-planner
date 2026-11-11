# Syllabus Planner

Upload a syllabus PDF, pull exact due dates from your Brightspace calendar, review everything, and send it to your Notion Student Planner in one click.

## How it works

1. Pick a course (loaded from your Notion **Courses** database) and the semester dates.
2. Upload the syllabus PDF. Optionally include your Brightspace calendar feed.
3. The AI builds a list of assignments and exams using these rules:
   - Related items are combined (Midterm Part 1 + Part 2 becomes one entry)
   - Extra credit, optional work, and surveys are skipped
   - Rule-based items are generated ("homework due every Monday")
   - Week-only exams get a Monday to Friday window
   - Brightspace dates win when both sources list the same item
4. Review: edit names and dates, uncheck anything wrong. Items already in Notion are flagged and unchecked.
5. Send. Each item becomes an entry in your **Assignments** database, linked to the course.

## Setup

Copy `.env.example` to `.env.local` (local) or add the same variables in Vercel:

| Variable | What it is |
| --- | --- |
| `APP_PASSWORD` | The password to get into the app |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `ANTHROPIC_MODEL` | Optional, defaults to `claude-sonnet-5-5` |
| `NOTION_TOKEN` | Internal integration secret, with the integration connected to the Student Planner page |
| `NOTION_COURSES_DB` / `NOTION_ASSIGNMENTS_DB` | Database IDs (defaults are set) |
| `BRIGHTSPACE_ICS_URL` | Brightspace Calendar > Subscribe link. Treat it like a password. |

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # parser and duplicate-check tests
```

## Roadmap

- `.ics` export and Google Calendar for people who don't use Notion
- Accounts so friends can use it
- Reminders before big exams
