# Prep Tracker

Reads your preparation plan from a Google Sheet, emails you calendar invites when a topic is due for a check,
runs an AI mock interview (Claude), scores you, and writes the result back to the sheet. It also sends a daily
reminder email listing what's due or overdue.

## Using the Excel file (default)

When `ML_Learning_Tracker.xlsx` is in this folder, the portal uses it instead of Google (no Google login needed;
interview invites arrive as email calendar attachments).

- **Due dates**: each phase runs from the Roadmap's *Start date* for its *Planned Weeks*, and that phase's topics are
  spread evenly across it in sheet order. Phases with 0 weeks (e.g. the specialization you skip) have no dates.
  To set a topic's date yourself, fill in **Target Date** (column J).
- **Statuses** (column F dropdown): Not Started, In Progress, Ready for Review, Needs Modification, Done.
- The portal writes Interview Score, AI Feedback, Next Review, Invite Sent For, Last Reminder (K-O), the Date
  Completed (H) when you pass, and a row in the **Interview History** sheet.
- `npm run prepare-excel` adds those columns; the original is kept as `ML_Learning_Tracker.backup.xlsx`.
- Close the file in Excel while an interview is being scored; saving an older copy from Excel would overwrite it.

## How it works

| Sheet status | What the app does |
|---|---|
| `Not Started` | Included in the daily reminder when the planned date is near or past. |
| `In Progress` / `Ready for Review` | When the planned time is within 24h, emails you a calendar invite with the interview link. |
| `Needs Modification` | Same as above, using `Next Review` (set automatically to 3 days after a failed interview). |
| `Done` | Ignored. |

After an interview the app writes **Score**, **Feedback** and **Status** (`Done` if score ≥ 7, else
`Needs Modification`) back to the sheet and adds the full transcript to the **History** tab.

### Sheet columns (Tracker tab)

| A Topic | B Key Points | C Planned | D Status | E Score | F Feedback | G Next Review | H Invite Sent For | I Last Reminder |
|---|---|---|---|---|---|---|---|---|
| React hooks | useState, useEffect cleanup, custom hooks, rules of hooks | 2026-11-02 18:30 | In Progress | | | | | |

- You fill **A-D**. Write dates as `YYYY-MM-DD HH:mm`. If Sheets changes how they look, format column C as *Plain text*.
- **Key Points** is what the interviewer checks you on. The more specific it is, the fairer the score.
- Columns E-I are filled in by the app. Clear **H** to force a new invite.
- The interview link uses the row number, so avoid inserting rows above topics that already have invites pending.

## Setup (about 15 minutes)

### 1. Install
```bash
npm install
```

### 2. Claude API key
Open `.env.local` and paste your key after `ANTHROPIC_API_KEY=`. Don't paste keys into chats.
`.env.local` is in `.gitignore`, so it won't be committed.

### 3. Google account (Sheets + Calendar)
The app signs in as your Google account with an OAuth client (`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`).
In https://console.cloud.google.com, for the project that owns the client:
1. **APIs & Services → Library**: enable **Google Sheets API** and **Google Calendar API**.
2. **Credentials → your OAuth client → Authorized redirect URIs**: add
   `http://localhost:3000/api/google/callback` (and `https://<your-app>/api/google/callback` once deployed).
3. **OAuth consent screen / Audience**: either add your Gmail as a **test user**, or click **Publish app**.
   In *Testing* mode Google expires the sign-in after 7 days, so publish it to keep it running (you'll see an
   "unverified app" warning when signing in; click *Advanced → Continue*, which is fine for your own app).
4. Put your sheet's ID (from its URL) into `SHEET_ID`.
5. Run `npm run dev`, open http://localhost:3000 and click **Connect Google**. The token is saved to
   `.env.local` automatically. Restart `npm run dev`.
6. Run `npm run setup-sheet` to create the `Tracker` and `History` tabs with headers.

Interviews then appear as real events in your Google Calendar, with a 15-minute popup reminder.

### 4. Email (Gmail)
1. Turn on 2-Step Verification on your Google account.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. Set `SMTP_USER` (your Gmail), `SMTP_PASS` (the 16-character app password) and `NOTIFY_EMAIL`
   (where invites and reminders go).

### 5. Run it
```bash
npm run dev          # website at http://localhost:3000
npm run local-cron   # in a second terminal: checks the sheet every 15 minutes
```
Set `APP_PASSWORD` to put a login prompt on the site (any username, that password).

## Deploying (so it runs when your laptop is off)
1. Push to GitHub and import the repo on https://vercel.com.
2. Add every variable from `.env.local` in **Project → Settings → Environment Variables**, and set `APP_URL`
   to your Vercel URL.
3. Vercel's free plan only runs `vercel.json` crons once a day (09:00 IST). For checks every 15 minutes, create a free job at
   https://cron-job.org that calls `https://<your-app>/api/cron?secret=<CRON_SECRET>` every 15 minutes.

## Settings (`.env.local`)
| Variable | Default | Meaning |
|---|---|---|
| `TZ_OFFSET` | `+05:30` | Timezone used to read the times in the sheet |
| `PASS_SCORE` | `7` | Score needed for `Done` |
| `RETRY_DAYS` | `3` | Days until the next interview after a failed one |
| `INVITE_HOURS_BEFORE` | `24` | How early the invite email is sent |
| `REMIND_HOURS_BEFORE` | `24` | How close to the deadline a topic enters the daily reminder |
| `DIGEST_HOUR` | `9` | Earliest hour (local) for the daily reminder email |
| `INTERVIEW_MINUTES` | `30` | Length of the calendar event |

## Production (Azure VM)

Live at **https://preptracker.52.172.90.237.sslip.io** (browser login: any username + `APP_PASSWORD`).

- VM `ema-scanner-vm` (resource group `EMA-SCANNER-RG`), user `azureuser`, shared with other apps behind the
  `ema-scanner-caddy` container. This app's Caddy site is `/opt/caddy-sites/preptracker.caddy`.
- Container `preptracker` on `172.18.0.1:8200`, settings in `~/preptracker/.env`, data (Excel file, backups,
  settings) in `~/preptracker/data` mounted at `/app/data`. The scheduler runs inside the container every 15 minutes,
  so don't also run `npm run local-cron` against the same Excel file.

Update to the latest code:
```bash
ssh azureuser@52.172.90.237
cd ~/preptracker/app && git pull && sudo docker build -t preptracker:latest .
sudo docker rm -f preptracker && sudo docker run -d --name preptracker --restart unless-stopped \
  -p 172.18.0.1:8200:3000 --env-file ~/preptracker/.env -v ~/preptracker/data:/app/data preptracker:latest
```
