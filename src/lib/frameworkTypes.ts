// Shared types used by every framework's section data file (brsrSections, cdpSections, ...).

export type FieldKind =
  | "text"
  | "longtext"
  | "number"
  | "date"
  | "email"
  | "tel"
  | "select"
  | "selectCountry"
  | "selectGood"
  | "selectDependent"
  | "boolean"
  | "computed";

export interface BaseField {
  id: string;
  label: string;
  required?: boolean;
  unit?: string;
  help?: string;
}

export type Field =
  | (BaseField & { kind: "text" | "longtext" | "email" | "tel" })
  | (BaseField & { kind: "number"; min?: number; max?: number; step?: number })
  | (BaseField & { kind: "date" })
  | (BaseField & { kind: "boolean" })
  | (BaseField & { kind: "select"; options: readonly string[] })
  | (BaseField & { kind: "selectCountry" })
  | (BaseField & { kind: "selectGood" })
  | (BaseField & {
      kind: "selectDependent";
      dependsOn: string;
      map: Record<string, readonly string[]>;
      fallback: readonly string[];
    })
  // computed: read-only display field whose value is derived from other answers.
  // The compute function receives the full answers map for the framework so it
  // can look up values across questions; it returns a number (or null when not
  // enough inputs exist yet to compute a meaningful result).
  | (BaseField & {
      kind: "computed";
      compute: (ctx: ComputeContext) => number | null;
      formula?: string; // human-readable formula shown beside the value, e.g. "K = AT + CT − FT + Y'"
    });

export type QuestionKind = "fields" | "table";

export interface FieldsQuestion {
  id: string;
  label: string;
  description?: string;
  kind: "fields";
  fields: Field[];
}

export interface TableQuestion {
  id: string;
  label: string;
  description?: string;
  kind: "table";
  columns: Field[];
  minRows: number;
  maxRows?: number;
  rowLabel?: (i: number) => string;
}

export type Question = FieldsQuestion | TableQuestion;

export interface Section {
  id: string;
  title: string;
  sheetRef: string;
  questions: Question[];
}

// Context handed to compute() for cross-question lookups.
export interface ComputeContext {
  // Get a field value from a specific question. Returns the raw value (number,
  // string, boolean, null) — callers usually coerce via num().
  get: (questionId: string, fieldId: string) => unknown;
  // Coerce any value to a number; non-numeric returns 0 (matches Excel's
  // behaviour for blank cells inside arithmetic formulas).
  num: (v: unknown) => number;
}
