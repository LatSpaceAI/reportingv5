"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { frameworks, computeProgress, type FrameworkSummary } from "@/lib/frameworks";
import { formatUpdated } from "@/lib/storage";
import { useToast } from "@/components/Toast";

type CategoryFilter = "all" | "Climate" | "Sustainability" | "Regulatory";
type StatusFilter = "all" | "active" | "coming-soon";

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tick, setTick] = useState(0);
  const { show } = useToast();

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return frameworks.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (status !== "all" && f.status !== status) return false;
      if (needle) {
        const hay = `${f.name} ${f.shortName} ${f.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [search, category, status]);

  return (
    <div className="px-8 py-6">
      <TopBar
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        status={status}
        setStatus={setStatus}
        onNewReport={() => show("New Report creation is coming soon.")}
      />
      <div className="mt-6">
        <h1 className="text-xl font-semibold text-slate-900">Available Disclosures &amp; Reports</h1>
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {frameworks.length} results
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500">
          <div>Disclosure &amp; Report</div>
          <div>Description</div>
          <div>Progress</div>
          <div>Last Updated</div>
          <div>Export</div>
        </div>
        <div className="hidden">{tick}</div>
        {filtered.map((f) => (
          <Row
            key={f.id}
            f={f}
            onExport={async () => {
              if (f.id !== "cbam") {
                show(`Export for ${f.shortName} is coming soon.`);
                return;
              }
              try {
                show(`Generating ${f.shortName} export…`);
                const { exportCbamFilled } = await import("@/lib/cbamExport/export");
                await exportCbamFilled();
                show("Export ready — download starting.");
              } catch (e) {
                console.error(e);
                show("Export failed. See console for details.");
              }
            }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No frameworks match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar(props: {
  search: string;
  setSearch: (v: string) => void;
  category: CategoryFilter;
  setCategory: (v: CategoryFilter) => void;
  status: StatusFilter;
  setStatus: (v: StatusFilter) => void;
  onNewReport: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <input
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
          placeholder="Search frameworks..."
          className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      </div>
      <select
        value={props.category}
        onChange={(e) => props.setCategory(e.target.value as CategoryFilter)}
        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
      >
        <option value="all">All Categories</option>
        <option value="Climate">Climate</option>
        <option value="Sustainability">Sustainability</option>
        <option value="Regulatory">Regulatory</option>
      </select>
      <select
        value={props.status}
        onChange={(e) => props.setStatus(e.target.value as StatusFilter)}
        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="coming-soon">Coming Soon</option>
      </select>
      <div className="ml-auto">
        <button
          onClick={props.onNewReport}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <span className="text-lg leading-none">+</span> New Report
        </button>
      </div>
    </div>
  );
}

function Row({ f, onExport }: { f: FrameworkSummary; onExport: () => void }) {
  const { pct, lastUpdated } = computeProgress(f);
  const isActive = f.status === "active";
  return (
    <div className="grid grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60">
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 shrink-0 rounded-md grid place-items-center text-[10px] font-bold ${f.logoColor}`}
        >
          {f.logoInitials}
        </div>
        <div className="min-w-0">
          {isActive ? (
            <Link href={`/report/${f.id}`} className="font-medium text-slate-900 hover:underline">
              {f.shortName}
            </Link>
          ) : (
            <span className="font-medium text-slate-700">{f.shortName}</span>
          )}
          <div className="text-xs text-slate-500">
            {f.cadence}
            {!isActive && <span className="ml-2 text-slate-400">· Coming soon</span>}
          </div>
        </div>
      </div>
      <div className="pr-4 text-sm text-slate-600 line-clamp-2">{f.description}</div>
      <div>
        {isActive ? (
          <div>
            <div className="text-sm font-medium text-slate-900">{pct}%</div>
            <div className="mt-1 h-1 w-24 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <div>
            <div className="text-sm font-medium text-slate-400">0%</div>
            <div className="mt-1 h-1 w-24 rounded-full bg-slate-100" />
          </div>
        )}
      </div>
      <div className="text-sm text-slate-600">
        {isActive ? formatUpdated(lastUpdated) : "—"}
      </div>
      <div>
        <button
          onClick={onExport}
          disabled={!isActive}
          className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export
        </button>
      </div>
    </div>
  );
}
