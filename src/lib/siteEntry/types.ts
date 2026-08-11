// Shared types for the monthly site-return entry flow.
//
// The central ESG team receives filled forms from site teams and enters them
// here. Each site files its own form layout, so the shape of the entry screen
// is data — read from esg.site_form_field via /api/esg/entry/form — rather than
// hard-coded per site.

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "returned";

export type Provenance = "entered" | "imported" | "parsed" | "estimated";

export type ColumnKind =
  | "quantity"
  | "reused_onsite"
  | "disposed_offsite"
  | "agency"
  | "comment";

export interface SiteSummary {
  id: number;
  code: string;
  name: string;
  assetType: "commercial" | "residential" | "group";
  city: string | null;
  region: string | null;
  waterStressed: boolean;
}

export interface PeriodSummary {
  id: number;
  fiscalYear: string;
  monthNo: number | null;
  monthLabel: string | null;
  periodKind: "month" | "ytd" | "baseline";
}

/** One row of a site's form, as it should be rendered. */
export interface FormField {
  fieldId: number;
  groupLabel: string | null;
  rowOrder: number;
  /** The label exactly as printed on the site's own form, typos included. */
  label: string;
  /** The unit as printed on the form — what the user types in. */
  formUnit: string | null;
  columnKind: ColumnKind;
  /** Canonical parameter this row feeds; null = captured but not consolidated. */
  parameterKey: string | null;
  parameterLabel: string | null;
  /** Canonical unit, which may differ from formUnit (Ltrs vs kL). */
  parameterUnit: string | null;
  /** Multiplier from form unit to canonical unit (0.001 for Ltrs->kL). */
  unitFactor: number;
  /** Rows sharing a key are summed into one parameter (Level 8 + Level 13). */
  aggregateKey: string | null;
  /** The site's own hand-computed total — cross-checked, never consolidated. */
  isFormTotal: boolean;
  isRequired: boolean;
  /** Value captured for completeness only; feeds no disclosure. */
  isMemo: boolean;
  helpText: string | null;
  notes: string | null;
}

export interface FormLayout {
  formId: number;
  formCode: string;
  formName: string;
  formRef: string | null;
  fields: FormField[];
}

/**
 * A value as held in the entry screen.
 *
 * `raw` is what the user typed, kept as a string so a half-typed "1." doesn't
 * round-trip through a number and lose the trailing character. `notAvailable`
 * is the explicit "the site marked this NA" state — categorically different
 * from a reported zero, and the reason the two are separate fields rather than
 * one nullable number.
 */
export interface EntryValue {
  raw: string;
  notAvailable: boolean;
  /** Original text where a number had to be read out of it ("58 kg"). */
  rawText?: string;
  comment?: string;
}

export type EntryValues = Record<string, EntryValue>;

/** Keys an entry value by field, since one parameter can have several rows. */
export function fieldKey(f: Pick<FormField, "fieldId">): string {
  return String(f.fieldId);
}

export interface SavedValue {
  parameterKey: string;
  valueNum: number | null;
  isNotAvailable: boolean;
  provenance: Provenance;
  rawText: string | null;
  comment: string | null;
  sourceDoc: string | null;
}

export interface EntrySnapshot {
  site: SiteSummary;
  period: PeriodSummary;
  form: FormLayout;
  values: SavedValue[];
  submission: {
    status: SubmissionStatus;
    submittedBy: string | null;
    submittedAt: string | null;
    reviewNote: string | null;
  } | null;
  flags: DataFlag[];
}

export interface DataFlag {
  id?: number;
  parameterKey: string | null;
  ruleCode: string;
  severity: "info" | "warning" | "error";
  message: string;
  acknowledgedAt?: string | null;
}

/** What the client POSTs to save a month. */
export interface SaveEntryRequest {
  siteCode: string;
  fiscalYear: string;
  monthNo: number;
  /** Keyed by form field id — the server resolves fields to parameters. */
  values: Record<string, EntryValue>;
  status?: Extract<SubmissionStatus, "draft" | "submitted">;
  sourceDoc?: string;
  enteredBy?: string;
}

export interface SaveEntryResponse {
  saved: number;
  flags: DataFlag[];
  status: SubmissionStatus;
}
