import Link from "next/link";
import { excelExists, excelPath } from "@/lib/excel";
import { oauthConfigured, oauthConnected } from "@/lib/google";
import { dataSource } from "@/lib/store";
import { readSettings } from "@/lib/settings";
import { connectSheet, createSheet, uploadExcel } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const settings = readSettings();
  const sheetId = settings.sheetId || process.env.SHEET_ID;
  const googleReady = oauthConnected() || !oauthConfigured();

  return (
    <>
      <Link href="/">&larr; Tracker</Link>
      <h1 style={{ marginTop: 12 }}>Settings</h1>

      {ok && <div className="card notice">{ok}</div>}
      {error && <div className="card error">{error}</div>}

      {dataSource() === "excel" && (
        <section className="card stack">
          <h2>Excel file (in use)</h2>
          <p>
            Reading and updating <code>{excelPath()}</code>
            {!excelExists() && <b className="overdue"> - file not found</b>}.
          </p>
          <p className="muted small">
            Change a topic&apos;s status from the Tracker page. For bigger edits (dates, weeks, new topics), download the
            file, edit it in Excel and upload it here. Uploading replaces the server copy; the previous one is kept as a
            backup. Download a fresh copy first so you don&apos;t lose scores recorded since your last download.
          </p>
          <div className="actions" style={{ marginLeft: 0 }}>
            <a href="/api/excel" className="button-link">
              Download Excel
            </a>
          </div>
          <form action={uploadExcel} className="upload-form">
            <input type="file" name="file" accept=".xlsx" required />
            <button type="submit" className="secondary">
              Upload Excel
            </button>
          </form>
        </section>
      )}

      {dataSource() === "google" && <section className="card stack">
        <h2>Google Sheet</h2>
        {sheetId ? (
          <p>
            Using{" "}
            <a href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} target="_blank" rel="noreferrer">
              {settings.sheetTitle || "your sheet"}
            </a>
            . Topics go on the <b>Tracker</b> tab; interview transcripts are saved on <b>History</b>.
          </p>
        ) : (
          <p className="muted">No sheet added yet.</p>
        )}

        {!googleReady ? (
          <p>
            First <a href="/api/google/auth">connect your Google account</a>.
          </p>
        ) : (
          <>
            <form action={connectSheet} className="stack">
              <label htmlFor="sheet">{sheetId ? "Switch to another sheet" : "Use an existing sheet"}</label>
              <input id="sheet" name="sheet" placeholder="https://docs.google.com/spreadsheets/d/..." required />
              <div>
                <button type="submit">Save sheet</button>
              </div>
              <p className="muted small">
                Tracker and History tabs are added if missing. Row 1 of an existing tab is never overwritten, so its
                columns must match: Topic, Key Points, Planned, Status, Score, Feedback, Next Review, Invite Sent For,
                Last Reminder.
              </p>
            </form>
            <form action={createSheet}>
              <p className="muted">Or let the portal create a ready-made sheet in your Google Drive:</p>
              <button type="submit" className="secondary">
                Create a new tracker sheet
              </button>
            </form>
          </>
        )}
      </section>}
    </>
  );
}
