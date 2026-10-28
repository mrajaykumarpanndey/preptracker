// Adds the tracker columns, statuses and Interview History sheet to the Excel file. Run once: npm run prepare-excel
import { excelPath, prepareExcel } from "../lib/excel";

await prepareExcel();
console.log(`Prepared ${excelPath()} (original saved next to it as .backup.xlsx)`);
