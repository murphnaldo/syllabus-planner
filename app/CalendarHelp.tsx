"use client";

import { useEffect, useState } from "react";

type Tab = "google" | "apple" | "outlook";

const TABS: { id: Tab; label: string }[] = [
  { id: "google", label: "Google Calendar" },
  { id: "apple", label: "Apple Calendar" },
  { id: "outlook", label: "Outlook" },
];

/** Step-by-step help for importing the downloaded .ics file. */
export default function CalendarHelp({
  fileName,
  courseLabel,
  canEmail,
}: {
  fileName: string;
  courseLabel: string;
  canEmail: boolean;
}) {
  const [tab, setTab] = useState<Tab>("google");
  const [isPhone, setIsPhone] = useState(false);
  const calName = courseLabel || "this course";

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsPhone(/iPhone|iPad|iPod|Android/i.test(ua));
    if (ios) setTab("apple");
  }, []);

  return (
    <div className="cal-help stack">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "primary" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "google" && (
        <>
          {isPhone && (
            <p className="warn" style={{ margin: 0 }}>
              The Google Calendar phone app can't import files. Do these steps on a computer
              {canEmail ? ", or use \"Email this file to me\" below and open the email on your computer." : "."}
            </p>
          )}
          <ol className="steps-list">
            <li>
              <b>Optional but smart:</b> make a separate calendar for the course so you can show, hide, or delete it all
              at once. In Google Calendar, click the <b>+</b> next to "Other calendars", choose <b>Create new calendar</b>,
              and name it "{calName}".
            </li>
            <li>
              Open <a href="https://calendar.google.com/calendar/r/settings/export" target="_blank" rel="noreferrer">Google Calendar's Import page</a>{" "}
              (Settings, then Import &amp; export).
            </li>
            <li>
              Click <b>Select file from your computer</b> and choose <b>{fileName}</b> from your Downloads folder.
            </li>
            <li>Under "Add to calendar", pick the calendar you want (like "{calName}").</li>
            <li>
              Click <b>Import</b>. You should see "Imported X out of X events", and your due dates appear on your
              calendar and phone.
            </li>
          </ol>
        </>
      )}

      {tab === "apple" && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            <b>On iPhone or iPad</b>
          </p>
          <ol className="steps-list">
            <li>
              {canEmail ? (
                <>
                  Tap <b>Email this file to me</b> below, then open the email in the Mail app and tap the attachment.
                  (Or open <b>{fileName}</b> from the Files app, in Downloads.)
                </>
              ) : (
                <>
                  Open the <b>Files</b> app, go to <b>Downloads</b>, and tap <b>{fileName}</b>.
                </>
              )}
            </li>
            <li>
              Tap <b>Add All</b>, choose a calendar (you can make a new one called "{calName}" first in the Calendar app),
              and tap <b>Done</b>.
            </li>
          </ol>
          <p className="small muted" style={{ margin: 0 }}>
            <b>On a Mac</b>
          </p>
          <ol className="steps-list">
            <li>
              Double-click <b>{fileName}</b> in your Downloads folder. Calendar opens.
            </li>
            <li>
              Choose which calendar to add the events to, then click <b>OK</b>.
            </li>
          </ol>
        </>
      )}

      {tab === "outlook" && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            <b>Outlook on the web</b> (your school email calendar, at outlook.office.com)
          </p>
          <ol className="steps-list">
            <li>
              Open the <b>Calendar</b>, then click <b>Add calendar</b> in the left sidebar.
            </li>
            <li>
              Choose <b>Upload from file</b>, click <b>Browse</b>, and pick <b>{fileName}</b>.
            </li>
            <li>
              Pick the calendar to add them to and click <b>Import</b>.
            </li>
          </ol>
          <p className="small muted" style={{ margin: 0 }}>
            <b>Outlook desktop app:</b> File, then Open &amp; Export, then Import/Export, then "Import an iCalendar (.ics)
            file", and choose <b>{fileName}</b>.
          </p>
        </>
      )}
    </div>
  );
}
