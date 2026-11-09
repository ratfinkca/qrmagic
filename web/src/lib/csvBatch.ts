import Papa from "papaparse";
import type { CsvBatch, QrMagicProject } from "../types";
import type { ProductionIssue } from "./productionPdfModel";
import { productionCount, normalizeFixedJob } from "./production";

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_COLUMNS = 100;
const MAX_ROWS = 100_000;
const MAX_CELLS = 1_000_000;

function validColumns(columns: string[]) {
  return columns.length > 0 && columns.length <= MAX_COLUMNS
    && columns.every(column => typeof column === "string" && column.trim() === column && column)
    && new Set(columns.map(column => column.toLowerCase())).size === columns.length;
}

export function parseCsvBatch(name: string, input: string): CsvBatch {
  // Remove the final line terminator while retaining any intentionally blank records.
  const { data, errors } = Papa.parse(input.replace(/\r\n$|[\r\n]$/, ""), { delimiter: "," });
  if (errors.length) {
    const error = errors[0];
    throw new Error(`Check the CSV formatting${error.row == null ? "" : ` near record ${error.row + 1} (counting the header)`}. ${error.message}`);
  }
  const [header = [], ...records] = data;
  const columns = header.map(column => column.trim());
  if (!validColumns(columns)) throw new Error("Use 1 to 100 unique, non-empty column names in the first row.");
  if (!records.length) throw new Error("Add at least one data row below the column names.");
  if (records.length > MAX_ROWS || records.length * columns.length > MAX_CELLS) {
    throw new Error("Use at most 100,000 data rows and 1,000,000 cells.");
  }
  const rows = records.map((record, index) => {
    if (record.length > columns.length) throw new Error(`Data row ${index + 1} has more values than the header has columns.`);
    return columns.map((_, columnIndex) => record[columnIndex] ?? "");
  });
  return { name, columns, rows };
}

export function validateCsvBatch(csv: CsvBatch) {
  if (!csv || typeof csv.name !== "string" || !Array.isArray(csv.columns) || !validColumns(csv.columns)
    || !Array.isArray(csv.rows) || !csv.rows.length || csv.rows.length > MAX_ROWS
    || csv.rows.length * csv.columns.length > MAX_CELLS
    || csv.rows.some(row => !Array.isArray(row) || row.length !== csv.columns.length || row.some(value => typeof value !== "string"))
    || (csv.allowRepeatedQr !== undefined && typeof csv.allowRepeatedQr !== "boolean")) {
    throw new Error("This project contains an invalid CSV batch.");
  }
}

export function withCsvBatch(project: QrMagicProject, csv?: CsvBatch): QrMagicProject {
  const next = {
    ...project,
    data: { ...project.data, csv },
    layers: project.layers.map(layer => {
      if ((layer.type === "qr" || layer.type === "text") && layer.csvColumn && !csv?.columns.includes(layer.csvColumn)) {
        return { ...layer, csvColumn: undefined };
      }
      return layer;
    }),
  };
  productionCount(next);
  return normalizeFixedJob(next);
}

type IssueKind = "missing-qr" | "missing-text" | "duplicate-qr";
type CsvRowIssue = { kind: IssueKind; layerName: string };
const counts = { "missing-qr": 0, "missing-text": 0, "duplicate-qr": 0 };

export function reviewCsvBatch({ data: { csv }, layers }: QrMagicProject) {
  const rows = new Map<number, CsvRowIssue[]>();
  function add(index: number, issue: CsvRowIssue) {
    const issues = rows.get(index);
    if (issues) issues.push(issue);
    else rows.set(index, [issue]);
  }
  if (csv) for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0 || (layer.type !== "qr" && layer.type !== "text") || !layer.csvColumn) continue;
    const column = csv.columns.indexOf(layer.csvColumn);
    const seen = new Map<string, number>();
    const missing = { kind: layer.type === "qr" ? "missing-qr" : "missing-text", layerName: layer.name } as const;
    const duplicate = { kind: "duplicate-qr", layerName: layer.name } as const;
    csv.rows.forEach((record, index) => {
      const value = record[column] ?? "";
      if (!value.trim()) add(index, missing);
      else if (layer.type === "qr" && !csv.allowRepeatedQr) {
        const first = seen.get(value);
        if (first === undefined) seen.set(value, index);
        else {
          if (first >= 0) {
            add(first, duplicate);
            seen.set(value, -1);
          }
          add(index, duplicate);
        }
      }
    });
  }
  const totals = { ...counts };
  for (const issues of rows.values()) {
    for (const kind of new Set(issues.map(issue => issue.kind))) totals[kind]++;
  }
  return { rows, missingQrRows: totals["missing-qr"], missingTextRows: totals["missing-text"], duplicateQrRows: totals["duplicate-qr"] };
}

export function csvPreflight(project: QrMagicProject): ProductionIssue[] {
  const review = reviewCsvBatch(project);
  const issues: ProductionIssue[] = [];
  if (review.missingQrRows) issues.push({ severity: "error", code: "csv-missing-qr",
    message: `CSV rows with missing QR content: ${review.missingQrRows}. Review the CSV batch before exporting.` });
  if (review.missingTextRows) issues.push({ severity: "warning", code: "csv-missing-text", category: "quality",
    message: `CSV rows with missing text: ${review.missingTextRows}. Those text layers will print blank.` });
  if (review.duplicateQrRows) issues.push({ severity: "warning", code: "csv-duplicate-qr", category: "quality",
    message: `CSV rows sharing a QR value: ${review.duplicateQrRows}. Review the repeats in the CSV batch.` });
  return issues;
}
