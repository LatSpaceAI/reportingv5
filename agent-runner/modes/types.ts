// Shared types between runner.ts and the per-mode handlers. The chat and
// write request shapes mirror the dispatcher routes one-to-one — keeping the
// JSON contract stable means we don't have to coordinate two parsers when the
// frontend evolves.

export type EmitFn = (event: string, data: unknown) => void;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface QuestionContext {
  kind: "question";
  question: {
    id: string;
    label: string;
    sectionId: string;
    sectionTitle: string;
    questionKind: "fields" | "table";
    description?: string;
  };
  answer?: {
    status: "not-started" | "in-progress" | "completed";
    filledCount: number;
    totalFields: number;
    preview?: string;
  };
}

export interface DocumentContext {
  kind: "document";
  title: string;
  outline: Array<{
    id: string;
    kind: string;
    level?: 1 | 2 | 3;
    heading?: string;
    preview?: string;
  }>;
}

export type ChatContext = QuestionContext | DocumentContext;

/** A user-uploaded document the agent can retrieve from (AI-Context tab). Only
 *  the Blob URL travels in the job — the index itself is fetched in-sandbox. */
export interface UserDocRef {
  id: string;
  name: string;
  blobUrl: string;
}

export interface ChatJob {
  mode: "chat";
  messages: ChatMessage[];
  framework?: string;
  context?: ChatContext | null;
  userDocs?: UserDocRef[];
}

export interface OutlineItem {
  id: string;
  kind:
    | "heading"
    | "paragraph"
    | "table"
    | "requirement-ref"
    | "data-ref"
    | "section-marker"
    | "diagram";
  level?: 1 | 2 | 3;
  heading?: string;
  preview?: string;
}

export interface WriteJob {
  mode: "write";
  instruction: string;
  outline: OutlineItem[];
  framework?: string;
  userDocs?: UserDocRef[];
}

// ---------------------------------------------------------------------------
// Fill mode — "Fill with AI" for the structured questionnaire (BRSR/CDP).
//
// The dispatcher resolves the active question(s) against the framework's
// section data and ships a self-describing field schema so the in-sandbox
// agent knows the exact shape (kind, options, bounds) each value must take.
// The agent retrieves from the user's PDFs, the Supabase ESG DB, the AI
// Context profile, and the web, then emits one structured proposal per
// question for the user to review field-by-field.
// ---------------------------------------------------------------------------

/** One field the agent must try to fill, flattened from a framework Field. */
export interface FillFieldSpec {
  id: string;
  label: string;
  /** Mirrors frameworkTypes FieldKind, minus "computed" (never AI-filled). */
  kind:
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
    | "boolean";
  required?: boolean;
  unit?: string;
  help?: string;
  /** Allowed values for select kinds; the proposed value must be one of these. */
  options?: string[];
  min?: number;
  max?: number;
}

/** A single question to fill, with its field schema and current values. */
export interface FillQuestionSpec {
  id: string;
  label: string;
  description?: string;
  sectionId: string;
  sectionTitle: string;
  questionKind: "fields" | "table";
  /** For "fields": the fields to fill. For "table": the column schema. */
  fields: FillFieldSpec[];
  /** For "table" questions only: how many rows to propose at minimum. */
  minRows?: number;
  /** Fields/columns the user has ALREADY filled — the agent leaves these alone
   *  unless empty. Keys are field ids; values are the current raw values. */
  existingValues?: Record<string, unknown>;
}

/** The org profile captured on the AI-Context tab (lib/aiContext.ts). */
export interface FillAiContext {
  companyName?: string;
  websiteUrl?: string;
  reportingYear?: number | null;
  businessContext?: string;
}

export interface FillJob {
  mode: "fill";
  framework?: string;
  questions: FillQuestionSpec[];
  userDocs?: UserDocRef[];
  aiContext?: FillAiContext;
  /** When true, the agent may query the Supabase ESG database. The credentials
   *  themselves travel via the sandbox env, never in the job payload. */
  useEsgDb?: boolean;
}

/** A proposed value for one field, streamed back for per-field review. */
export interface ProposedField {
  fieldId: string;
  /** Proposed value, already coerced to the field's kind by the agent. */
  value: string | number | boolean | null;
  /** 0–1 self-rated confidence. */
  confidence: number;
  /** Human-readable provenance, e.g. "Acme Report.pdf p.12" or
   *  "ESG DB: Scope 2 total, GROUP, FY2024-25". */
  source: string;
  /** One short sentence on how the value was derived. */
  rationale?: string;
}

/** The agent's proposal for one question (emitted as a `fill_proposal` event). */
export interface FillProposal {
  questionId: string;
  fields: ProposedField[];
  /** For table questions: one ProposedField[] per proposed row. */
  rows?: ProposedField[][];
  /** Fields the agent could not find any grounded value for. */
  unfilled?: { fieldId: string; reason: string }[];
}
