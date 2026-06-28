"use client";

// Data Logbook — ported from hindalco's /plant/logbook page and restyled to
// plato-v1's design language. The original fetched from a mock API via React
// Query; here the seed data lives in ./data and approve/reject mutate local
// state. Filtered to the plant-manager's site, matching the source view.

import { Fragment, useMemo, useState } from "react";

import { useToast } from "@/components/Toast";
import { ParameterDataDropdown } from "./ParameterDataDropdown";
import { logbookEntries as seedEntries, type LogbookEntry } from "./data";

// hindalco's plant manager is assigned to site-1; the seed data is already
// filtered to that site, but we keep the constant for parity.
const PLANT_MANAGER_SITE_ID = "site-1";

type TabType = "approved" | "under_review_rejected";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "Production", label: "Production" },
  { value: "Energy", label: "Energy" },
  { value: "Fuel", label: "Fuel" },
  { value: "RawMaterial", label: "Raw Material" },
  { value: "Emissions", label: "Emissions" },
] as const;

export default function LogbookPage() {
  const { show } = useToast();
  const [entries, setEntries] = useState<LogbookEntry[]>(() =>
    seedEntries.filter((e) => e.siteId === PLANT_MANAGER_SITE_ID),
  );
  const [activeTab, setActiveTab] = useState<TabType>("approved");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const approveEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: "Approved", reviewedBy: "plant_mgr", reviewedAt: new Date().toISOString() }
          : e,
      ),
    );
    show("Entry approved successfully.");
  };

  const rejectEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "Rejected",
              reviewedBy: "plant_mgr",
              reviewedAt: new Date().toISOString(),
              rejectionReason: "Rejected by plant manager",
            }
          : e,
      ),
    );
    show("Entry rejected.");
  };

  const stats = useMemo(() => {
    const total = entries.length;
    const submitted = entries.filter((e) => e.status === "Submitted").length;
    const underReview = entries.filter((e) => e.status === "UnderReview").length;
    const changesRequested = entries.filter((e) => e.status === "Rejected").length;
    const approved = entries.filter((e) => e.status === "Approved").length;
    const anomaliesDetected = entries.filter((e) => (e.anomalyCount || 0) > 0).length;
    return { total, submitted, underReview, changesRequested, approved, anomaliesDetected };
  }, [entries]);

  const sortedEntries = useMemo(() => {
    const byTab = entries.filter((e) =>
      activeTab === "approved"
        ? e.status === "Approved"
        : e.status === "UnderReview" || e.status === "Submitted" || e.status === "Rejected",
    );
    const term = searchTerm.toLowerCase();
    const filtered = byTab.filter((e) => {
      const matchesSearch =
        e.period.toLowerCase().includes(term) || e.siteName.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    return [...filtered].sort(
      (a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
    );
  }, [entries, activeTab, searchTerm, categoryFilter]);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1200px] px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#0A0A0A]">Data Logbook</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review and approve data entry submissions from AI Bulk Upload.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex">
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`px-6 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all ${
              activeTab === "approved"
                ? "bg-brand text-white"
                : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Approved Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("under_review_rejected")}
            className={`px-6 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all ${
              activeTab === "under_review_rejected"
                ? "bg-[#0A0A0A] text-white"
                : "border border-l-0 border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Under Review &amp; Rejected
          </button>
        </div>

        {/* Search + category */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by site or period…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors hover:border-gray-400 focus:border-brand"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-[200px] border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors hover:border-gray-400 focus:border-brand"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="mb-8 border border-gray-200 bg-gray-50 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total Entries" value={stats.total} tone="text-[#0A0A0A]" />
            <Stat label="Submitted" value={stats.submitted} tone="text-blue-600" />
            <Stat label="Under Review" value={stats.underReview} tone="text-amber-600" />
            <Stat label="Changes Requested" value={stats.changesRequested} tone="text-red-600" />
            <Stat label="Approved" value={stats.approved} tone="text-brand" />
            <Stat label="Anomalies Detected" value={stats.anomaliesDetected} tone="text-orange-600" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden border border-gray-200 bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                {["Period", "Category", "Anomalies", "Submitted By", "Submitted Date", "Status", "Reviewed By"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-600"
                    >
                      {h}
                    </th>
                  ),
                )}
                <th className="px-4 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.length > 0 ? (
                sortedEntries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4 text-[13px] font-medium text-gray-900">{entry.period}</td>
                        <td className="px-4 py-4">
                          <CategoryBadge category={entry.category} />
                        </td>
                        <td className="px-4 py-4">
                          <AnomalyBadge count={entry.anomalyCount} />
                        </td>
                        <td className="px-4 py-4 text-[13px] text-gray-600">{entry.submittedBy}</td>
                        <td className="px-4 py-4 text-[13px] text-gray-600">
                          {new Date(entry.submittedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-4 py-4 text-[13px] text-gray-600">{entry.reviewedBy || "-"}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {entry.status === "Submitted" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => approveEntry(entry.id)}
                                  className="inline-flex items-center gap-1.5 bg-brand px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white transition-colors hover:bg-brand-medium"
                                >
                                  <CheckIcon className="h-3.5 w-3.5" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectEntry(entry.id)}
                                  className="inline-flex items-center gap-1.5 bg-red-600 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white transition-colors hover:bg-red-700"
                                >
                                  <XIcon className="h-3.5 w-3.5" />
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-600 transition-colors hover:text-brand"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDownIcon className="h-4 w-4" />
                                  Hide Data
                                </>
                              ) : (
                                <>
                                  <ChevronRightIcon className="h-4 w-4" />
                                  View Data
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <ParameterDataDropdown
                              category={entry.category}
                              entryId={entry.id}
                              onToggle={() => setExpandedEntryId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                    {entries.length === 0
                      ? "No entries yet."
                      : "No entries found matching your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 text-[12px] text-gray-500">{label}</div>
      <div className={`text-3xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700 border-gray-300",
    Submitted: "bg-blue-50 text-blue-700 border-blue-200",
    UnderReview: "bg-amber-50 text-amber-700 border-amber-200",
    Approved: "bg-brand/[0.08] text-brand border-brand/20",
    Rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status] || ""}`}
    >
      {status === "UnderReview" ? "Under Review" : status}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    Production: "bg-blue-50 text-blue-700 border-blue-200",
    Energy: "bg-amber-50 text-amber-700 border-amber-200",
    Fuel: "bg-orange-50 text-orange-700 border-orange-200",
    RawMaterial: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Emissions: "bg-purple-50 text-purple-700 border-purple-200",
    Other: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[category] || ""}`}
    >
      {category === "RawMaterial" ? "Raw Material" : category}
    </span>
  );
}

function AnomalyBadge({ count }: { count?: number }) {
  if (!count || count === 0) return <span className="text-[12px] text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1 border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-600">
      <AlertTriangleIcon className="h-3 w-3" />
      {count} {count === 1 ? "Anomaly" : "Anomalies"}
    </span>
  );
}

// ── Inline lucide icons ─────────────────────────────────────────────────────

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
