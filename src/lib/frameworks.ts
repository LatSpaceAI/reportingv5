import { sections as cbamSections } from "./cbamSections";
import { sections as rcoSections } from "./rcoSections";
import { sections as cctsSections } from "./cctsSections";
import type { Section } from "./frameworkTypes";
import { CBAM_ANSWERS_KEY, RCO_ANSWERS_KEY, CCTS_ANSWERS_KEY, readAnswers, type Answers } from "./storage";

export type FrameworkStatus = "active" | "coming-soon";
export type FrameworkCategory = "Climate" | "Sustainability" | "Regulatory";

export interface FrameworkSummary {
  id: string;
  name: string;
  shortName: string;
  description: string;
  cadence: string;
  category: FrameworkCategory;
  status: FrameworkStatus;
  storageKey?: string;
  sections?: Section[];
  logoInitials: string;
  logoColor: string;
  logoSrc?: string;
}

export const frameworks: FrameworkSummary[] = [
  {
    id: "cbam",
    name: "Carbon Border Adjustment Mechanism",
    shortName: "CBAM Communication Template",
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
    id: "ccts",
    name: "Carbon Credit Trading Scheme — Cement Pro-Forma",
    shortName: "CCTS Pro-Forma (Cement Sector)",
    description:
      "BEE Cement-Sector pro-forma capturing production and energy consumption for CCTS baseline / target-year reporting (Form-Sb).",
    cadence: "Annual",
    category: "Regulatory",
    status: "active",
    storageKey: CCTS_ANSWERS_KEY,
    sections: cctsSections,
    logoInitials: "CC",
    logoColor: "bg-amber-100 text-amber-700",
    logoSrc: "/bee-logo.jpg",
  },
];

export function getFramework(id: string): FrameworkSummary | undefined {
  return frameworks.find((f) => f.id === id);
}

export function computeProgress(fw: FrameworkSummary): {
  pct: number;
  completed: number;
  total: number;
  lastUpdated?: string;
} {
  if (fw.status !== "active" || !fw.sections || !fw.storageKey) {
    return { pct: 0, completed: 0, total: 0 };
  }
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
