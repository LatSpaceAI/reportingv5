// Wire types shared by the Excel Entry screen and its two routes.
//
// Kept separate from importWorkbook.ts because that module is pure and gets
// imported by tests, while these describe the HTTP contract.

import type { DataFlag } from "./types";
import type { ImportedCell } from "./importWorkbook";

/** One row as the preview table shows it. */
export interface PreviewRow extends ImportedCell {
  /** Canonical unit, for display next to the converted value. */
  parameterUnit: string | null;
  /** The form's own label, when it differs from what the file printed. */
  formLabel: string | null;
  /** Value already stored for this parameter, when re-uploading a month. */
  existingValue: number | null;
  existingIsNotAvailable: boolean;
  /** True when this row would change a value already stored. */
  isChange: boolean;
  /** Flags naming this parameter — anomalies, mostly. */
  flags: DataFlag[];
}

export interface PreviewResponse {
  ok: boolean;
  error?: string;
  /** Sheet names found, so a rejection can name them. */
  monthlySheetNames?: string[];

  batchId?: number;
  filename?: string;
  sheetName?: string | null;

  site?: { code: string; name: string };
  period?: { fiscalYear: string; monthNo: number; monthLabel: string | null };
  form?: { code: string; name: string };

  /** What the parser read out of the file's own header, for display. */
  detected?: {
    siteName: string | null;
    monthNo: number | null;
    fiscalYear: string | null;
    sourceText: string | null;
    /** True when the file's own site name did not resolve to a known site. */
    siteAmbiguous: boolean;
  };

  rows?: PreviewRow[];
  /** Flags not tied to a single row (missing required fields, cross-row rules). */
  formFlags?: DataFlag[];

  /** Set when this site-month already holds data — the override warning. */
  existing?: {
    valueCount: number;
    changedCount: number;
    status: string;
    lastEnteredBy: string | null;
    lastUpdatedAt: string | null;
    /** A previous import, when there was one. */
    previousBatchId: number | null;
  } | null;

  summary?: {
    matched: number;
    unmatched: number;
    notAvailable: number;
    anomalies: number;
    missingRequired: number;
  };
}

/** A reviewer's correction, applied before commit. */
export interface CommitEdit {
  /** Form field this row targets. */
  fieldId: number;
  /** The value in the FORM's unit, as corrected. Null clears the row. */
  value: number | null;
  notAvailable: boolean;
}

export interface CommitRequest {
  batchId: number;
  siteCode: string;
  fiscalYear: string;
  monthNo: number;
  /** Only rows the reviewer changed need to be sent. */
  edits?: CommitEdit[];
  /** Explicit acknowledgement that this replaces existing data. */
  overrideExisting?: boolean;
  enteredBy?: string;
}

export interface CommitResponse {
  ok: boolean;
  error?: string;
  /** Set when the month already has data and overrideExisting was not passed. */
  requiresOverride?: boolean;
  saved?: number;
  superseded?: number;
  flags?: DataFlag[];
  /**
   * Always 'draft'. Committing an import records the figures; it does not
   * submit the return. A human submits explicitly from the site-return screen.
   */
  status?: string;
}
