import { sections as cbamSections, type Section } from "./cbamSections";
import { CBAM_ANSWERS_KEY, readAnswers, type Answers } from "./storage";

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
  },
  {
    id: "cdp",
    name: "Carbon Disclosure Project",
    shortName: "CDP Climate Change 2024",
    description:
      "Global environmental disclosure system that enables companies to measure and manage climate impact.",
    cadence: "Annual",
    category: "Climate",
    status: "coming-soon",
    logoInitials: "CDP",
    logoColor: "bg-rose-50 text-rose-600",
  },
  {
    id: "brsr",
    name: "Business Responsibility & Sustainability Report",
    shortName: "BRSR",
    description:
      "Mandatory sustainability reporting framework for top 1000 listed companies in India under SEBI.",
    cadence: "Annual",
    category: "Regulatory",
    status: "coming-soon",
    logoInitials: "BRSR",
    logoColor: "bg-indigo-50 text-indigo-700",
  },
  {
    id: "gresb",
    name: "Global Real Estate Sustainability Benchmark",
    shortName: "GRESB",
    description:
      "Leading ESG benchmark for real estate and infrastructure investments.",
    cadence: "Annual",
    category: "Sustainability",
    status: "coming-soon",
    logoInitials: "GR",
    logoColor: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "tcfd",
    name: "Task Force on Climate-related Financial Disclosures",
    shortName: "TCFD",
    description:
      "Framework for climate-related financial risk disclosure, now superseded by IFRS S2.",
    cadence: "Annual",
    category: "Climate",
    status: "coming-soon",
    logoInitials: "TCFD",
    logoColor: "bg-sky-50 text-sky-700",
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
