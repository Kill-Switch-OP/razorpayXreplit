import type { BusinessData, RadarContextState } from "./types";

export interface DataHealth {
  recognizedDatasets: number;
  totalRecords: number;
  relationshipsResolved: number;
  missingRequiredFields: number;
  missingRequiredIds: number;
  duplicateIds: number;
  malformedDates: number;
  missingAmounts: number;
  unsupportedSheets: number;
  warnings: string[];
}

export interface WorkbookSheetReport {
  name: string;
  normalizedType: string;
  rowCount: number;
  supported: boolean;
  alias?: string;
  preview: Array<Record<string, unknown>>;
}

export interface WorkbookImportReport {
  fileName: string;
  importedAt: string;
  status: string;
  totalRecords: number;
  detectedSources: string[];
  sheets: WorkbookSheetReport[];
  aliases: Record<string, string[]>;
  datasets: Record<string, { recordCount: number; aliases: string[]; available: boolean }>;
  dataHealth: DataHealth;
}

let importedData: Partial<BusinessData> = {};
let report: WorkbookImportReport | null = null;
let contextState: RadarContextState = "NO_CONTEXT";

export function setWorkbookImport(data: Partial<BusinessData>, nextReport: WorkbookImportReport) {
  importedData = data;
  report = nextReport;
  contextState = "IMPORTED_CONTEXT";
}

export function getImportedData() {
  return importedData;
}

export function getWorkbookReport() {
  return report;
}

export function getContextState(): RadarContextState {
  return contextState;
}

export function clearWorkbookImport() {
  importedData = {};
  report = null;
  contextState = "NO_CONTEXT";
}