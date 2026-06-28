// Field-schema extraction for "Fill with AI".
//
// The client sends only a framework id + question id(s) + the user's current
// values. The route uses this module to resolve each question against the
// framework's section data (brsrSections / cdpSections) and build the
// self-describing FillQuestionSpec the agent runner needs — so the schema
// (kind, options, bounds) is derived server-side from the canonical source,
// never trusted from the client.

import { getFramework } from "@/lib/frameworks";
import type { Field, Question, Section } from "@/lib/frameworkTypes";

// Mirrors agent-runner/modes/types.ts FillFieldSpec. Kept in sync by hand —
// the two packages don't share a types module (same rationale as the
// duplicated resolveRagFramework in dispatcher/frameworks.ts).
export interface FillFieldSpec {
  id: string;
  label: string;
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
  options?: string[];
  min?: number;
  max?: number;
}

export interface FillQuestionSpec {
  id: string;
  label: string;
  description?: string;
  sectionId: string;
  sectionTitle: string;
  questionKind: "fields" | "table";
  fields: FillFieldSpec[];
  minRows?: number;
  existingValues?: Record<string, unknown>;
}

/** Flatten a framework Field into the agent-facing spec. Returns null for
 *  "computed" fields — those are derived from other answers, never AI-filled. */
function toFieldSpec(f: Field): FillFieldSpec | null {
  if (f.kind === "computed") return null;
  const spec: FillFieldSpec = {
    id: f.id,
    label: f.label,
    kind: f.kind,
    required: f.required,
    unit: f.unit,
    help: f.help,
  };
  if (f.kind === "select") {
    spec.options = [...f.options];
  } else if (f.kind === "selectDependent") {
    // Offer the union of every dependent option list plus the fallback, so the
    // agent has the full vocabulary even though the live UI narrows it by the
    // dependsOn value. Re-validated against the active field on save.
    const all = new Set<string>(f.fallback);
    for (const list of Object.values(f.map)) for (const o of list) all.add(o);
    spec.options = [...all];
  } else if (f.kind === "number") {
    if (typeof f.min === "number") spec.min = f.min;
    if (typeof f.max === "number") spec.max = f.max;
  }
  return spec;
}

function findQuestion(
  sections: Section[],
  questionId: string
): { section: Section; question: Question } | null {
  for (const section of sections) {
    for (const question of section.questions) {
      if (question.id === questionId) return { section, question };
    }
  }
  return null;
}

/** Build a FillQuestionSpec for one question id in a framework, merging in the
 *  user's current values. Returns null if the framework/question is unknown. */
export function buildFillQuestionSpec(
  frameworkId: string,
  questionId: string,
  existingValues?: Record<string, unknown>
): FillQuestionSpec | null {
  const fw = getFramework(frameworkId);
  if (!fw?.sections) return null;
  const found = findQuestion(fw.sections, questionId);
  if (!found) return null;
  const { section, question } = found;

  const rawFields = question.kind === "fields" ? question.fields : question.columns;
  const fields = rawFields
    .map(toFieldSpec)
    .filter((f): f is FillFieldSpec => f !== null);

  return {
    id: question.id,
    label: question.label,
    description: question.description,
    sectionId: section.id,
    sectionTitle: section.title,
    questionKind: question.kind,
    fields,
    minRows: question.kind === "table" ? question.minRows : undefined,
    existingValues,
  };
}
