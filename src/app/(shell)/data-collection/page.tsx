"use client";

// Data Collection hub — ported from hindalco's /plant/data-entry landing page
// and restyled to plato-v1's design language. Choose an entry method; each one
// lives on its own sub-route and picks up the period from the return itself.

import Link from "next/link";

import {
  PageHeader,
  UploadIcon,
  PencilIcon,
  SpreadsheetIcon,
  SlidersIcon,
} from "./shared";

const METHODS = [
  {
    href: "/data-collection/site-return",
    title: "Monthly Site Return",
    description:
      "Enter a site's monthly ESG return. Each site's own form layout is reproduced as filed.",
    icon: <PencilIcon className="h-5 w-5" />,
  },
  {
    href: "/data-collection/standard-return",
    title: "Standard Return",
    description:
      "Download the standard template, fill it in, and upload it back. Read by parameter key, so a renamed row still imports.",
    icon: <SpreadsheetIcon className="h-5 w-5" />,
  },
  {
    href: "/data-collection/excel-entry",
    title: "Excel Entry",
    description:
      "Upload a month's site return as filed on the site's own form. Values are parsed, checked against last year, and reviewed before they are recorded.",
    icon: <UploadIcon className="h-5 w-5" />,
  },
  {
    href: "/data-collection/scope3-ledgers",
    title: "Scope 3 Ledgers",
    description:
      "Value-chain data: purchase orders, material deliveries, freight, travel and tenant energy. One row is one transaction, not one monthly figure.",
    icon: <SpreadsheetIcon className="h-5 w-5" />,
  },
] as const;

// A settings page, not an entry method. Every card above writes input_value;
// this one writes the reference values those figures are computed FROM, so it
// belongs under its own heading rather than inside "Choose a data entry method".
const SETTINGS = [
  {
    href: "/data-collection/constants",
    title: "Emission Factors & Constants",
    description:
      "Emission factors, refrigerant GWPs and unit conversions. Editing one shows what it changes before it is saved.",
    icon: <SlidersIcon className="h-5 w-5" />,
  },
] as const;

export default function DataCollectionPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <PageHeader
          icon={<UploadIcon className="h-5 w-5" />}
          title="Data Collection"
          subtitle="Choose a method and submit your emissions data."
        />

        <div className="space-y-8">
          <div>
            {/* Was "Choose a data entry method" — no longer accurate now that a
                Settings section sits below it. */}
            <h2 className="mb-3 text-[13px] font-semibold text-[#0A0A0A]">Data entry</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {METHODS.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="group flex h-full flex-col border border-gray-200 p-5 transition-all hover:border-brand/50 hover:bg-brand/[0.02]"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center bg-brand/[0.06] text-brand transition-transform group-hover:scale-105">
                    {m.icon}
                  </div>
                  <h3 className="mb-1 text-[14px] font-semibold text-[#0A0A0A]">
                    {m.title}
                  </h3>
                  <p className="mt-auto text-[12px] leading-relaxed text-gray-500">
                    {m.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[13px] font-semibold text-[#0A0A0A]">Settings</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {SETTINGS.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="group flex h-full flex-col border border-gray-200 p-5 transition-all hover:border-brand/50 hover:bg-brand/[0.02]"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center bg-brand/[0.06] text-brand transition-transform group-hover:scale-105">
                    {m.icon}
                  </div>
                  <h3 className="mb-1 text-[14px] font-semibold text-[#0A0A0A]">
                    {m.title}
                  </h3>
                  <p className="mt-auto text-[12px] leading-relaxed text-gray-500">
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
