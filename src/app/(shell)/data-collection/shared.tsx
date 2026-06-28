"use client";

// Shared building blocks for the Data Collection feature (ported from hindalco's
// /plant/data-entry pages and restyled to plato-v1's design language). Kept in
// one module so the hub and the manual/document/bulk sub-pages stay consistent.

import { useEffect, useState } from "react";

// ── Reporting period ────────────────────────────────────────────────────────
// The month/year the entered data applies to. Persisted to localStorage so the
// selection carries from the hub into a sub-page and back.

const PERIOD_KEY = "data-collection:period";

export const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

// The 7 sites covered by the standardized input sheet (order matches the
// master ESG workbook's "Input Sheet - *" tabs).
export const SITES = [
  "Group",
  "Mattampally",
  "Gudipadu",
  "Bayyavaram",
  "Dachepalli",
  "Jeerabad",
  "Jajpur",
] as const;

export type Site = (typeof SITES)[number];

export interface ReportingPeriod {
  month: number;
  year: number;
  site: Site;
}

export function monthLabel(month: number): string {
  return MONTHS.find((m) => m.value === month)?.label ?? "";
}

/** Reactive reporting-period state backed by localStorage. */
export function useReportingPeriod(): [ReportingPeriod, (p: ReportingPeriod) => void] {
  const [period, setPeriodState] = useState<ReportingPeriod>({ month: 1, year: 2025, site: SITES[0] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERIOD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReportingPeriod>;
        if (typeof parsed.month === "number" && typeof parsed.year === "number") {
          const site = (SITES as readonly string[]).includes(parsed.site as string)
            ? (parsed.site as Site)
            : SITES[0];
          setPeriodState({ month: parsed.month, year: parsed.year, site });
          return;
        }
      }
    } catch {}
    // Default to the current month/year only on the client (avoids SSR drift).
    const now = new Date();
    setPeriodState({ month: now.getMonth() + 1, year: now.getFullYear(), site: SITES[0] });
  }, []);

  const setPeriod = (p: ReportingPeriod) => {
    setPeriodState(p);
    try {
      localStorage.setItem(PERIOD_KEY, JSON.stringify(p));
    } catch {}
  };

  return [period, setPeriod];
}

// Shared Tailwind atoms matching the AI Context page conventions.
export const labelClass =
  "block text-[11px] text-brand tracking-[0.15em] uppercase font-medium mb-2";
export const inputClass =
  "w-full border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors hover:border-gray-300 focus:border-brand disabled:opacity-50";

// ── Reporting period card ───────────────────────────────────────────────────

export function ReportingPeriodCard({
  period,
  onChange,
  disabled,
}: {
  period: ReportingPeriod;
  onChange: (p: ReportingPeriod) => void;
  disabled?: boolean;
}) {
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
  return (
    <section className="border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-brand" />
          <h3 className="text-[13px] font-semibold text-[#0A0A0A]">Reporting Period</h3>
        </div>
        <span className="bg-brand/[0.06] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-brand">
          {period.site} • {monthLabel(period.month)} {period.year}
        </span>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Site</label>
          <select
            value={period.site}
            onChange={(e) => onChange({ ...period, site: e.target.value as Site })}
            disabled={disabled}
            className={`${inputClass} w-full`}
          >
            {SITES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Month</label>
          <select
            value={period.month}
            onChange={(e) => onChange({ ...period, month: Number(e.target.value) })}
            disabled={disabled}
            className={`${inputClass} w-full`}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Year</label>
          <select
            value={period.year}
            onChange={(e) => onChange({ ...period, year: Number(e.target.value) })}
            disabled={disabled}
            className={`${inputClass} w-full`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

// ── Page header (icon tile + title + subtitle, optional back link) ──────────

export function PageHeader({
  icon,
  title,
  subtitle,
  backHref,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {backHref && (
        <a
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0A0A0A]/50 transition-colors hover:text-brand"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back to Data Collection
        </a>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center bg-brand/[0.06] text-brand">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
    </header>
  );
}

// ── Inline lucide icons (18px stroke-2), matching the app's inline-SVG style ──

export function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

// lucide: pencil-line
export function PencilIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// lucide: sparkles
export function SparklesIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

// lucide: file-spreadsheet
export function SpreadsheetIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h2" />
      <path d="M14 13h2" />
      <path d="M8 17h2" />
      <path d="M14 17h2" />
    </svg>
  );
}

// lucide: upload
export function UploadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

// lucide: factory
export function FactoryIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1" />
      <path d="M12 18h1" />
      <path d="M7 18h1" />
    </svg>
  );
}

// lucide: zap
export function ZapIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

// lucide: leaf
export function LeafIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

// lucide: file-text
export function FileTextIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

// lucide: x
export function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// lucide: check-circle
export function CheckCircleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

// lucide: alert-triangle
export function AlertTriangleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// lucide: download
export function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

// lucide: paperclip
export function PaperclipIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

// lucide: rotate-ccw
export function RotateCcwIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// lucide: save
export function SaveIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </svg>
  );
}
