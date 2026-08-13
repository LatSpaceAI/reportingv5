export const BRSR_ANSWERS_KEY = "brsr-app/v2";
export const CDP_ANSWERS_KEY = "cdp-app/v1";

// v1 answers were pre-populated with Sagar Cements FY2023-24 sample data by the
// (since removed) brsrSeed.ts, and the questionnaire persisted that merge back
// to localStorage — so the demo values outlive the code that produced them.
// Dropping the old key on load is the only way to clear them from browsers
// that have already visited the report.
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("brsr-app/v1");
  } catch {
    // localStorage unavailable (private mode etc.) — nothing to purge.
  }
}

// Framework-agnostic prefix for per-question assignee data, namespaced by
// framework id at write time (see readAssignees / writeAssignees).
export const ASSIGNEES_KEY = "reporting-app/assignees/v1";

export type Status = "not-started" | "in-progress" | "completed";

export interface SavedAnswer {
  values: Record<string, unknown>;
  rows: Record<string, unknown>[];
  status: Status;
  updatedAt?: string;
}

export type Answers = Record<string, SavedAnswer>;

export function readAnswers(key: string): Answers {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}

export type Assignees = Record<string, string[]>;

export function readAssignees(frameworkId: string): Assignees {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${ASSIGNEES_KEY}/${frameworkId}`);
    return raw ? (JSON.parse(raw) as Assignees) : {};
  } catch {
    return {};
  }
}

export function writeAssignees(frameworkId: string, a: Assignees): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${ASSIGNEES_KEY}/${frameworkId}`, JSON.stringify(a));
}

export const mockUsers = [
  { id: "u1", name: "Ishan Mehta", email: "ishan@latspace.in" },
  { id: "u2", name: "Kshitiz Nigam", email: "kn@latspace.in" },
  { id: "u3", name: "Priya Sharma", email: "priya@latspace.in" },
  { id: "u4", name: "Arjun Rao", email: "arjun@latspace.in" },
  { id: "u5", name: "Meera Iyer", email: "meera@latspace.in" },
  { id: "u6", name: "Rohan Gupta", email: "rohan@latspace.in" },
] as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatUpdated(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
