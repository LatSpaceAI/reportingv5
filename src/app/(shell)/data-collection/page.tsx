"use client";

// Data Collection hub — ported from hindalco's /plant/data-entry landing page
// and restyled to plato-v1's design language. Pick a reporting period, then
// choose one of three entry methods, each on its own sub-route.

import Link from "next/link";

import {
  PageHeader,
  ReportingPeriodCard,
  useReportingPeriod,
  UploadIcon,
  PencilIcon,
  SparklesIcon,
  SpreadsheetIcon,
} from "./shared";

const METHODS = [
  {
    href: "/data-collection/manual",
    title: "Manual Data Entry",
    description:
      "Enter emissions and activity data manually through structured forms.",
    icon: <PencilIcon className="h-5 w-5" />,
  },
  {
    href: "/data-collection/document",
    title: "Smart Upload (AI-Powered)",
    description: "Upload documents and let AI extract the data automatically.",
    icon: <SparklesIcon className="h-5 w-5" />,
  },
  {
    href: "/data-collection/bulk",
    title: "Excel Upload",
    description: "Upload multiple records at once using Excel or CSV files.",
    icon: <SpreadsheetIcon className="h-5 w-5" />,
  },
] as const;

export default function DataCollectionPage() {
  const [period, setPeriod] = useReportingPeriod();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <PageHeader
          icon={<UploadIcon className="h-5 w-5" />}
          title="Data Collection"
          subtitle="Choose a method, select a reporting period, and submit your emissions data."
        />

        <div className="space-y-8">
          <ReportingPeriodCard period={period} onChange={setPeriod} />

          <div>
            <h2 className="mb-3 text-[13px] font-semibold text-[#0A0A0A]">
              Choose a data entry method
            </h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {METHODS.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="group flex flex-col border border-gray-200 p-5 transition-all hover:border-brand/50 hover:bg-brand/[0.02]"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center bg-brand/[0.06] text-brand transition-transform group-hover:scale-105">
                    {m.icon}
                  </div>
                  <h3 className="mb-1 text-[14px] font-semibold text-[#0A0A0A]">
                    {m.title}
                  </h3>
                  <p className="text-[12px] leading-relaxed text-gray-500">
                    {m.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
