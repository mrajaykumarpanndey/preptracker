import { config } from "./config";
import { googleRequest } from "./google";

export type Field =
  | "topic"
  | "keyPoints"
  | "planned"
  | "status"
  | "score"
  | "feedback"
  | "nextReview"
  | "inviteSentFor"
  | "lastReminder";

export type Row = Record<Field, string> & {
  row: number; // 1-based sheet row number
  category?: string;
  phase?: string;
  phaseName?: string;
  completed?: string; // "YYYY-MM-DD" when the topic was marked Done (Excel only)
};

export type HistoryEntry = { date: string; topic: string; score: number; minutes?: number };

export type RowUpdate = { row: number; fields: Partial<Record<Field, string>> };

// Column order in the Tracker tab. Keep in sync with HEADERS.
const COLUMNS: Record<Field, string> = {
  topic: "A",
  keyPoints: "B",
  planned: "C",
  status: "D",
  score: "E",
  feedback: "F",
  nextReview: "G",
  inviteSentFor: "H",
  lastReminder: "I",
};

export const HEADERS = [
  "Topic",
  "Key Points",
  "Planned (YYYY-MM-DD HH:mm)",
  "Status",
  "Score",
  "Feedback",
  "Next Review",
  "Invite Sent For",
  "Last Reminder",
];

const HISTORY_HEADERS = ["Date", "Topic", "Score", "Verdict", "Feedback", "Transcript", "Focused minutes"];

function call<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", data?: unknown): Promise<T> {
  return googleRequest<T>(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}${path}`, method, data);
}

const range = (a1: string) => encodeURIComponent(a1);

export async function listRows(): Promise<Row[]> {
  const data = await call<{ values?: string[][] }>(`/values/${range(`${config.tab}!A2:I`)}`);
  const fields = Object.keys(COLUMNS) as Field[];
  return (data.values ?? [])
    .map((values, i) => {
      const row = { row: i + 2 } as Row;
      fields.forEach((field, col) => (row[field] = (values[col] ?? "").trim()));
      return row;
    })
    .filter((row) => row.topic);
}

export async function updateRows(updates: RowUpdate[]): Promise<void> {
  const data = updates.flatMap(({ row, fields }) =>
    Object.entries(fields).map(([field, value]) => ({
      range: `${config.tab}!${COLUMNS[field as Field]}${row}`,
      values: [[value]],
    })),
  );
  if (data.length === 0) return;
  // RAW keeps "2026-11-02 18:30" as text instead of letting Sheets reformat it.
  await call("/values:batchUpdate", "POST", { valueInputOption: "RAW", data });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const data = await call<{ values?: string[][] }>(`/values/${range(`${config.historyTab}!A2:G`)}`);
  return (data.values ?? [])
    .map(([date = "", topic = "", score = "", , , , minutes = ""]) => ({ date, topic, score: Number(score), minutes: Number(minutes) || 0 }))
    .filter((entry) => entry.date && Number.isFinite(entry.score));
}

export async function appendHistory(values: string[]): Promise<void> {
  // A cell holds at most 50,000 characters.
  const safe = values.map((v) => v.slice(0, 49_000));
  await call(
    `/values/${range(`${config.historyTab}!A:G`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    "POST",
    { values: [safe] },
  );
}

/** Checks that the connected Google account can open the sheet; returns its title. */
export async function inspectSheet(sheetId: string): Promise<string> {
  const meta = await googleRequest<{ properties: { title: string } }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=properties.title`,
  );
  return meta.properties.title;
}

/** Creates the Tracker and History tabs if missing, and writes header rows where row 1 is empty. */
export async function setupSheet(): Promise<void> {
  const meta = await call<{ sheets: { properties: { title: string } }[] }>("?fields=sheets.properties.title");
  const existing = new Set(meta.sheets.map((s) => s.properties.title));
  const missing = [config.tab, config.historyTab].filter((title) => !existing.has(title));
  if (missing.length) {
    await call(":batchUpdate", "POST", {
      requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
    });
  }

  const tabs = [
    { range: `${config.tab}!A1:I1`, values: [HEADERS] },
    { range: `${config.historyTab}!A1:G1`, values: [HISTORY_HEADERS] },
  ];
  const current = await call<{ valueRanges: { values?: string[][] }[] }>(
    `/values:batchGet?${tabs.map((t) => `ranges=${range(t.range)}`).join("&")}`,
  );
  const data = tabs.filter((_, i) => !current.valueRanges[i]?.values?.length);
  if (data.length) await call("/values:batchUpdate", "POST", { valueInputOption: "RAW", data });
}

/** Creates a new spreadsheet in the connected Google account with headers and one example row. */
export async function createTrackerSheet(exampleDue: string): Promise<{ id: string; title: string }> {
  const title = "Placement Prep Tracker";
  const sheet = await googleRequest<{ spreadsheetId: string }>("https://sheets.googleapis.com/v4/spreadsheets", "POST", {
    properties: { title },
    sheets: [{ properties: { title: config.tab } }, { properties: { title: config.historyTab } }],
  });
  await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values:batchUpdate`, "POST", {
    valueInputOption: "RAW",
    data: [
      {
        range: `${config.tab}!A1:I2`,
        values: [
          HEADERS,
          [
            "JavaScript closures (example - edit or delete)",
            "What a closure is; lexical scope; closures in loops (var vs let); practical uses like data privacy and memoization",
            exampleDue,
            "In Progress",
          ],
        ],
      },
      { range: `${config.historyTab}!A1:G1`, values: [HISTORY_HEADERS] },
    ],
  });
  return { id: sheet.spreadsheetId, title };
}
