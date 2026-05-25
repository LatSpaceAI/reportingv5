import { sections as cbamSections } from "./cbamSections";
import { sections as rcoSections } from "./rcoSections";
import { sections as cctsSections } from "./cctsSections";
import type { Section } from "./frameworkTypes";
import {
  CBAM_ANSWERS_KEY,
  CCTS_ANSWERS_KEY,
  RCO_ANSWERS_KEY,
  readAnswers,
  type Answers,
} from "./storage";

export type FrameworkStatus = "active" | "coming-soon";
export type FrameworkCategory = "Climate" | "Sustainability" | "Regulatory";
export type FrameworkVariant = "questionnaire" | "qualitative";

export interface FrameworkSummary {
  id: string;
  name: string;
  shortName: string;
  description: string;
  cadence: string;
  category: FrameworkCategory;
  status: FrameworkStatus;
  // "questionnaire" — structured Q&A template (CBAM CT, RCO, CCTS PPC).
  // "qualitative" — narrative document with embedded requirements (CBAM MMD).
  variant?: FrameworkVariant;
  storageKey?: string;
  sections?: Section[];
  logoInitials: string;
  logoColor: string;
  logoSrc?: string;
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
    kind: "group",
    id: "cbam",
    name: "Carbon Border Adjustment Mechanism",
    shortName: "CBAM",
    description:
      "EU regulation requiring importers to report — and from 2026, pay for — embedded emissions in carbon-intensive imports.",
    cadence: "Quarterly",
    category: "Regulatory",
    logoInitials: "EU",
    logoColor: "bg-blue-100 text-blue-700",
    logoSrc: "/EU-logo.png",
    children: [
      {
        id: "cbam",
        name: "CBAM Communication Template",
        shortName: "Communication Template",
        description:
          "EU communication template for installations — per-product embedded emissions reported by operators outside the EU.",
        cadence: "Quarterly",
        category: "Regulatory",
        status: "active",
        storageKey: CBAM_ANSWERS_KEY,
        sections: cbamSections,
        logoInitials: "EU",
        logoColor: "bg-blue-100 text-blue-700",
        logoSrc: "/EU-logo.png",
      },
      {
        id: "cbam-mmd",
        name: "Monitoring Methodology Document",
        shortName: "MMD (Monitoring Methodology Document)",
        description:
          "Installation-level methodology describing system boundaries, data sources, and calculation approach used to determine embedded emissions.",
        cadence: "Annual",
        category: "Regulatory",
        status: "active",
        variant: "qualitative",
        logoInitials: "EU",
        logoColor: "bg-blue-100 text-blue-700",
        logoSrc: "/EU-logo.png",
      },
    ],
  },
  {
    id: "rco",
    name: "Renewable Consumption Obligation",
    shortName: "RCO — DCs with CPP & Open Access",
    description:
      "MoP RCO compliance return for Designated Consumers operating Captive Power Plants and consuming Open-Access power.",
    cadence: "Quarterly",
    category: "Regulatory",
    status: "active",
    storageKey: RCO_ANSWERS_KEY,
    sections: rcoSections,
    logoInitials: "RCO",
    logoColor: "bg-emerald-100 text-emerald-700",
    logoSrc: "/bee-logo.jpg",
  },
  {
    kind: "group",
    id: "ccts",
    name: "Carbon Credit Trading Scheme",
    shortName: "CCTS",
    description:
      "India's domestic carbon market — sector-wise compliance and offset mechanism administered by BEE under the Energy Conservation Act.",
    cadence: "Annual",
    category: "Regulatory",
    logoInitials: "CC",
    logoColor: "bg-amber-100 text-amber-700",
    logoSrc: "/bee-logo.jpg",
    children: [
      {
        id: "ccts",
        name: "Carbon Credit Trading Scheme — Aluminium Pro-Forma",
        shortName: "Pro-Forma (Aluminium Sector)",
        description:
          "BEE Aluminium-Sector pro-forma capturing refinery & smelter production, captive-power-plant operating data, and energy consumption for CCTS baseline / assessment-year reporting (Form Sa1 + Annex CPP).",
        cadence: "Annual",
        category: "Regulatory",
        status: "active",
        storageKey: CCTS_ANSWERS_KEY,
        sections: cctsSections,
        logoInitials: "CC",
        logoColor: "bg-amber-100 text-amber-700",
        logoSrc: "/bee-logo.jpg",
      },
      {
        id: "ccts-monitoring-plan",
        name: "CCTS Monitoring Plan",
        shortName: "Monitoring Plan",
        description:
          "Entity-level monitoring plan defining data flows, measurement equipment, and QA/QC procedures used to support CCTS compliance reports.",
        cadence: "Annual",
        category: "Regulatory",
        status: "coming-soon",
        logoInitials: "CC",
        logoColor: "bg-amber-100 text-amber-700",
        logoSrc: "/bee-logo.jpg",
      },
      {
        id: "ccts-ghg-reduction-action-plans",
        name: "CCTS GHG Reduction Action Plans",
        shortName: "GHG Reduction Action Plans",
        description:
          "Forward-looking abatement plans listing identified GHG reduction levers, expected savings, capex, and implementation timelines.",
        cadence: "Annual",
        category: "Regulatory",
        status: "coming-soon",
        logoInitials: "CC",
        logoColor: "bg-amber-100 text-amber-700",
        logoSrc: "/bee-logo.jpg",
      },
    ],
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
