// Creates the Tracker and History tabs with header rows. Run once: npm run setup-sheet
import { setupSheet } from "../lib/sheets";

await setupSheet();
console.log("Sheet ready: fill in rows on the Tracker tab.");
