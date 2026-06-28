// AI Context — the structured profile that grounds the AI assistant in the
// org's reporting situation (company, reports, VSME scope, reporting year, and a
// free-text business-context narrative).
//
// Ported from vsmev1's onboarding profile. plato-v1 has no auth/DB, so this is
// persisted client-side in localStorage (the same pattern as lib/storage.ts)
// rather than to an organizations row. The server-side VSME checklist and the
// Sculptor web-research feature are intentionally omitted here.

export const AI_CONTEXT_KEY = "reporting-app/ai-context/v1";

/**
 * Window event fired after the profile is saved, so other client components
 * (e.g. the sidebar's org label) can re-read the latest value within the same
 * tab. (The native `storage` event only fires across tabs, not the writer's.)
 */
export const AI_CONTEXT_UPDATED_EVENT = "ai-context:updated";

/** Report types the org intends to produce. */
export type ReportType = "vsme" | "cdp_sme";

/** VSME module scope. */
export type VsmeModules = "basic" | "basic_comprehensive";

export interface VsmeContext {
  /** Why the org is doing VSME (free text — e.g. bank request, customer ask). */
  purpose: string;
  /** Basic module only, or Basic + Comprehensive. */
  modules: VsmeModules;
}

export interface AiContextProfile {
  /** Company name. */
  companyName: string;
  /**
   * Company logo as a data URL (e.g. "data:image/png;base64,…"), or null.
   * Stored inline because plato-v1 has no upload backend; kept small (the
   * uploader downscales) so it fits comfortably in the localStorage quota.
   */
  logoDataUrl: string | null;
  /** Public website URL. */
  websiteUrl: string;
  /** Which reports the org is producing. */
  reports: ReportType[];
  /** VSME-specific answers. Present/meaningful only when reports includes "vsme". */
  vsme: VsmeContext | null;
  /** Reporting year, e.g. 2025. */
  reportingYear: number | null;
  /**
   * Free-text business context describing what the company does, its sector,
   * operations, and sustainability-relevant footprint. Grounds the AI assistant
   * in company-specific knowledge.
   */
  businessContext: string;
  /** ISO timestamp of the last edit. */
  updatedAt: string | null;
}

/** Max length of the businessContext narrative (generous cap). */
export const BUSINESS_CONTEXT_MAX = 8000;

export const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  {
    value: "vsme",
    label: "VSME",
    description: "EFRAG Voluntary Sustainability Reporting Standard for non-listed SMEs.",
  },
  {
    value: "cdp_sme",
    label: "CDP SME",
    description: "CDP climate disclosure questionnaire for small and mid-sized enterprises.",
  },
];

export const VSME_MODULE_OPTIONS: { value: VsmeModules; label: string; description: string }[] = [
  {
    value: "basic",
    label: "Basic Module only",
    description: "Disclosures B1–B11.",
  },
  {
    value: "basic_comprehensive",
    label: "Basic + Comprehensive Module",
    description: "Disclosures B1–B11 plus C1–C9.",
  },
];

/** An empty profile seeded with a company name (used as an editor default). */
export function emptyAiContextProfile(companyName = ""): AiContextProfile {
  return {
    companyName,
    logoDataUrl: null,
    websiteUrl: "",
    reports: [],
    vsme: null,
    reportingYear: null,
    businessContext: "",
    updatedAt: null,
  };
}

/** Accepted logo image types and the max stored size (post-downscale). */
export const LOGO_ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp";
export const LOGO_MAX_BYTES = 512 * 1024; // 512 KB data URL ceiling

/**
 * Coerce a stored (possibly legacy/partial) profile blob into the full current
 * shape, filling defaults for any missing field. Never throws — it's for reading
 * data the app itself wrote, where an older blob may simply lack newer keys.
 */
export function normalizeStoredProfile(
  stored: Partial<AiContextProfile> | null | undefined,
  fallbackName = "",
): AiContextProfile {
  const base = emptyAiContextProfile(fallbackName);
  if (!stored || typeof stored !== "object") return base;

  const reports = Array.isArray(stored.reports)
    ? stored.reports.filter(
        (r): r is ReportType => r === "vsme" || r === "cdp_sme",
      )
    : base.reports;

  const vsme: VsmeContext | null = reports.includes("vsme")
    ? {
        purpose:
          typeof stored.vsme?.purpose === "string" ? stored.vsme.purpose : "",
        modules:
          stored.vsme?.modules === "basic_comprehensive"
            ? "basic_comprehensive"
            : "basic",
      }
    : null;

  return {
    companyName:
      typeof stored.companyName === "string" ? stored.companyName : fallbackName,
    logoDataUrl:
      typeof stored.logoDataUrl === "string" && stored.logoDataUrl.startsWith("data:")
        ? stored.logoDataUrl
        : null,
    websiteUrl: typeof stored.websiteUrl === "string" ? stored.websiteUrl : "",
    reports,
    vsme,
    reportingYear:
      typeof stored.reportingYear === "number" ? stored.reportingYear : null,
    businessContext:
      typeof stored.businessContext === "string" ? stored.businessContext : "",
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
  };
}

/**
 * Validate and normalize an unknown value into an AiContextProfile. Returns
 * `{ profile }` on success or `{ error }` with a human-readable message.
 */
export function parseAiContextProfile(
  input: unknown,
): { profile: AiContextProfile } | { error: string } {
  if (typeof input !== "object" || input === null) {
    return { error: "Profile must be an object." };
  }
  const raw = input as Record<string, unknown>;

  const companyName = typeof raw.companyName === "string" ? raw.companyName.trim() : "";
  if (!companyName) return { error: "Company name is required." };
  if (companyName.length > 120) {
    return { error: "Company name must be 120 characters or fewer." };
  }

  const logoDataUrl =
    typeof raw.logoDataUrl === "string" && raw.logoDataUrl.startsWith("data:")
      ? raw.logoDataUrl
      : null;
  if (logoDataUrl && logoDataUrl.length > LOGO_MAX_BYTES * 2) {
    // data URLs are ~33% larger than the bytes they encode; allow generous slack.
    return { error: "Logo image is too large. Use one under 512 KB." };
  }

  const websiteUrl = typeof raw.websiteUrl === "string" ? raw.websiteUrl.trim() : "";
  if (websiteUrl.length > 300) {
    return { error: "Website URL must be 300 characters or fewer." };
  }

  const reportsRaw = Array.isArray(raw.reports) ? raw.reports : [];
  const reports = reportsRaw.filter(
    (r): r is ReportType => r === "vsme" || r === "cdp_sme",
  );

  let vsme: VsmeContext | null = null;
  if (reports.includes("vsme")) {
    const v =
      typeof raw.vsme === "object" && raw.vsme !== null
        ? (raw.vsme as Record<string, unknown>)
        : {};
    const modules = v.modules === "basic_comprehensive" ? "basic_comprehensive" : "basic";
    const purpose = typeof v.purpose === "string" ? v.purpose.trim() : "";
    if (purpose.length > 1000) {
      return { error: "VSME purpose must be 1000 characters or fewer." };
    }
    vsme = { purpose, modules };
  }

  let reportingYear: number | null = null;
  if (raw.reportingYear !== null && raw.reportingYear !== undefined && raw.reportingYear !== "") {
    const year = Number(raw.reportingYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { error: "Reporting year must be a year between 2000 and 2100." };
    }
    reportingYear = year;
  }

  const businessContext =
    typeof raw.businessContext === "string" ? raw.businessContext.trim() : "";
  if (businessContext.length > BUSINESS_CONTEXT_MAX) {
    return {
      error: `Business context must be ${BUSINESS_CONTEXT_MAX} characters or fewer.`,
    };
  }

  return {
    profile: {
      companyName,
      logoDataUrl,
      websiteUrl,
      reports,
      vsme,
      reportingYear,
      businessContext,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    },
  };
}

/** Read the saved AI Context profile from localStorage (null if none saved). */
export function readAiContext(): AiContextProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const rawStr = localStorage.getItem(AI_CONTEXT_KEY);
    if (!rawStr) return null;
    return normalizeStoredProfile(JSON.parse(rawStr) as Partial<AiContextProfile>);
  } catch {
    return null;
  }
}

/** Persist the AI Context profile to localStorage. */
export function writeAiContext(profile: AiContextProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_CONTEXT_KEY, JSON.stringify(profile));
  } catch {}
  // Notify same-tab listeners (the sidebar) that the profile changed.
  window.dispatchEvent(new Event(AI_CONTEXT_UPDATED_EVENT));
}
