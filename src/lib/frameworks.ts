import { sections as brsrSections } from "./brsrSections";
import { sections as cdpSections } from "./cdpSections";
import type { Section } from "./frameworkTypes";
import {
  BRSR_ANSWERS_KEY,
  CDP_ANSWERS_KEY,
  readAnswers,
  type Answers,
} from "./storage";

export type FrameworkStatus = "active" | "coming-soon";
export type FrameworkCategory = "Climate" | "Sustainability" | "Regulatory";
// "questionnaire" — structured Q&A template (e.g. CDP, BRSR).
// "qualitative"   — narrative document with embedded requirements.
// "export-only"   — no questions to answer here; the row exists so its Export
//                   action can populate a template from data collected elsewhere.
export type FrameworkVariant = "questionnaire" | "qualitative" | "export-only";

// Built-in logo marks, for entries with no logo image of their own.
export type FrameworkLogoIcon = "report";

export interface FrameworkSummary {
  id: string;
  name: string;
  shortName: string;
  description: string;
  cadence: string;
  category: FrameworkCategory;
  status: FrameworkStatus;
  variant?: FrameworkVariant;
  storageKey?: string;
  sections?: Section[];
  logoInitials: string;
  logoColor: string;
  logoSrc?: string;
  // Built-in mark for entries that have no logo of their own — preferred over
  // logoInitials, which renders bare letters.
  logoIcon?: FrameworkLogoIcon;
}

export interface FrameworkGroupChild extends FrameworkSummary {}

export interface FrameworkGroup {
  kind: "group";
  id: string;
  name: string;
  shortName: string;
  description: string;
  cadence: string;
  category: FrameworkCategory;
  logoInitials: string;
  logoColor: string;
  logoSrc?: string;
  children: FrameworkGroupChild[];
}

export type FrameworkEntry = (FrameworkSummary & { kind?: "single" }) | FrameworkGroup;

export const frameworkEntries: FrameworkEntry[] = [
  {
    id: "brsr",
    name: "Business Responsibility & Sustainability Report",
    shortName: "BRSR",
    description:
      "SEBI Annexure I — annual ESG disclosure covering general entity information, NGRBC management & process disclosures, and principle-wise performance against the nine NGRBC principles (Essential + Leadership indicators).",
    cadence: "Annual",
    category: "Sustainability",
    status: "active",
    storageKey: BRSR_ANSWERS_KEY,
    sections: brsrSections,
    logoInitials: "BR",
    logoColor: "bg-violet-100 text-violet-700",
    logoSrc: "/SEBI_logo.png",
  },
  {
    id: "cdp",
    name: "CDP Climate Change Questionnaire",
    shortName: "CDP",
    description:
      "Annual environmental disclosure to CDP — covers governance, strategy, risks & opportunities, value-chain engagement, scenario analysis, and detailed Scope 1/2/3 emissions, energy, targets, initiatives and project-based credits.",
    cadence: "Annual",
    category: "Climate",
    status: "active",
    storageKey: CDP_ANSWERS_KEY,
    sections: cdpSections,
    logoInitials: "CD",
    logoColor: "bg-rose-100 text-rose-700",
    logoSrc: "/cdp-logo.png",
  },
  {
    id: "brsr-environment",
    name: "Real Estate BRSR — Environment sheet",
    shortName: "Birla Estate BRSR Template",
    description:
      "Fills the client's own Real Estate BRSR template with energy, water, waste and emissions figures computed from the monthly site returns — its exact cells, layout and styling, left untouched where no return has been filed.",
    cadence: "Annual",
    category: "Regulatory",
    status: "active",
    variant: "export-only",
    // Not a SEBI-published form — it's the client's own workbook, so it gets a
    // generic report mark rather than a regulator's logo.
    logoIcon: "report",
    logoInitials: "BE",
    logoColor: "bg-emerald-100 text-emerald-700",
  },
];

// Flat list of all leaf frameworks — used by /report/[id], /table, getFramework.
export const frameworks: FrameworkSummary[] = frameworkEntries.flatMap((e) =>
  "kind" in e && e.kind === "group" ? e.children : [e as FrameworkSummary]
);

export function isGroup(e: FrameworkEntry): e is FrameworkGroup {
  return "kind" in e && e.kind === "group";
}

export function getFramework(id: string): FrameworkSummary | undefined {
  return frameworks.find((f) => f.id === id);
}

export function computeProgress(fw: FrameworkSummary): {
  pct: number;
  completed: number;
  total: number;
  lastUpdated?: string;
} {
  if (fw.status !== "active") return { pct: 0, completed: 0, total: 0 };

  if (fw.variant === "qualitative") {
    return computeQualitativeProgress(fw.id);
  }

  if (!fw.sections || !fw.storageKey) return { pct: 0, completed: 0, total: 0 };
  const total = fw.sections.reduce((n, s) => n + s.questions.length, 0);
  const saved: Answers = readAnswers(fw.storageKey);
  let completed = 0;
  let lastUpdated: string | undefined;
  for (const s of fw.sections) {
    for (const q of s.questions) {
      const a = saved[q.id];
      if (a?.status === "completed") completed += 1;
      if (a?.updatedAt && (!lastUpdated || a.updatedAt > lastUpdated)) {
        lastUpdated = a.updatedAt;
      }
    }
  }
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { pct, completed, total, lastUpdated };
}

function computeQualitativeProgress(frameworkId: string): {
  pct: number;
  completed: number;
  total: number;
  lastUpdated?: string;
} {
  if (typeof window === "undefined") return { pct: 0, completed: 0, total: 0 };
  try {
    const raw = localStorage.getItem(`qualitative-app/v1/${frameworkId}`);
    if (!raw) return { pct: 0, completed: 0, total: 0 };
    const doc = JSON.parse(raw) as {
      requirements?: { response: unknown; updatedAt?: string }[];
      updatedAt?: string;
    };
    const reqs = doc.requirements ?? [];
    const total = reqs.length;
    const completed = reqs.filter((r) => r.response != null).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { pct, completed, total, lastUpdated: doc.updatedAt };
  } catch {
    return { pct: 0, completed: 0, total: 0 };
  }
}
