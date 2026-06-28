"use client";

// Expanded "view data" panel for a logbook row — ported from hindalco and
// restyled to plato-v1. Renders the full baked parameter set with a name search.

import { useMemo, useState } from "react";

import {
  getParametersForCategory,
  getSectionDisplayName,
  formatNumber,
  type Parameter,
} from "./data";

// lucide: search
function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

// lucide: chevron-up
function ChevronUpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function ParameterDataDropdown({
  category,
  entryId,
  onToggle,
}: {
  category: string;
  entryId: string;
  onToggle: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const allParameters = useMemo(() => getParametersForCategory(category), [category]);

  const filteredParameters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allParameters;
    return allParameters.filter((p) => p.name.toLowerCase().includes(term));
  }, [allParameters, searchTerm]);

  const sectionName = getSectionDisplayName(category);
  const totalParams = allParameters.length;
  const displayedParams = filteredParameters.length;

  return (
    <div className="bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#0A0A0A]">
            {sectionName} ({totalParams} parameters)
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-gray-500">Job ID: {entryId}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 text-[12px] font-medium uppercase tracking-wider text-[#0A0A0A]/60 transition-colors hover:text-brand"
        >
          <ChevronUpIcon className="h-4 w-4" />
          Hide Data
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search parameters by name…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors hover:border-gray-300 focus:border-brand"
        />
      </div>

      {/* Parameter grid */}
      {filteredParameters.length > 0 ? (
        <div className="grid max-h-[600px] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
          {filteredParameters.map((param, index) => (
            <ParameterCard key={`${param.name}-${index}`} parameter={param} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-gray-500">
          No parameters found matching &quot;{searchTerm}&quot;
        </div>
      )}

      {searchTerm && (
        <div className="mt-4 text-center text-[12px] text-gray-500">
          Showing {displayedParams} of {totalParams} parameters
        </div>
      )}
    </div>
  );
}

function ParameterCard({ parameter }: { parameter: Parameter }) {
  return (
    <div className="border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[#0A0A0A]">{parameter.name}</span>
            {parameter.tag && (
              <span className="flex-shrink-0 bg-brand/[0.08] px-2 py-0.5 text-[11px] font-medium text-brand">
                {parameter.tag}
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-500">{parameter.unit}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-[15px] font-semibold text-[#0A0A0A]">
            {formatNumber(parameter.value || 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
