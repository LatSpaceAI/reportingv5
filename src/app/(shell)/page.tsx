"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  computeProgress,
  frameworkEntries,
  isGroup,
  type FrameworkEntry,
  type FrameworkGroup,
  type FrameworkSummary,
} from "@/lib/frameworks";
import { formatUpdated } from "@/lib/storage";
import { useToast } from "@/components/Toast";
import BrsrEnvironmentExportDialog from "@/components/BrsrEnvironmentExportDialog";

type CategoryFilter = "all" | "Climate" | "Sustainability" | "Regulatory";
type StatusFilter = "all" | "active" | "coming-soon";

const AUTOFILLED_IDS = new Set<string>([]);

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tick, setTick] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // `mounted` defers any localStorage-derived rendering (progress %, last-updated
  // dates) until after hydration, so SSR and the first client paint render the
  // same empty placeholders and React doesn't trip a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [envExportOpen, setEnvExportOpen] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    setMounted(true);
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  function matchLeaf(f: FrameworkSummary, needle: string): boolean {
    if (category !== "all" && f.category !== category) return false;
    if (status !== "all" && f.status !== status) return false;
    if (needle) {
      const hay = `${f.name} ${f.shortName} ${f.description}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  }

  const { entries: filteredEntries, leafCount, totalLeafCount } = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const total = frameworkEntries.reduce(
      (n, e) => n + (isGroup(e) ? e.children.length : 1),
      0,
    );
    const out: FrameworkEntry[] = [];
    let count = 0;
    for (const e of frameworkEntries) {
      if (isGroup(e)) {
        const matchedChildren = e.children.filter((c) => matchLeaf(c, needle));
        if (matchedChildren.length > 0) {
          out.push({ ...e, children: matchedChildren });
          count += matchedChildren.length;
        }
      } else if (matchLeaf(e as FrameworkSummary, needle)) {
        out.push(e);
        count += 1;
      }
    }
    return { entries: out, leafCount: count, totalLeafCount: total };
  }, [search, category, status]);

  const handleExport = async (f: FrameworkSummary) => {
    try {
      // Export-only rows have nothing to download until a year is picked, so
      // they open a dialog rather than firing a file straight away.
      if (f.id === "brsr-environment") {
        setEnvExportOpen(true);
        return;
      }
      if (f.id === "brsr") {
        show(`Generating ${f.shortName} export…`);
        const { exportBrsrFilled } = await import("@/lib/brsrExport/export");
        await exportBrsrFilled();
        show("Export ready — download starting.");
        return;
      }
      if (f.id === "cdp") {
        show(`Generating ${f.shortName} export…`);
        const { exportCdpFilled } = await import("@/lib/cdpExport/export");
        await exportCdpFilled();
        show("Export ready — download starting.");
        return;
      }
      show(`Export for ${f.shortName} is coming soon.`);
    } catch (err) {
      console.error(err);
      show("Export failed. See console for details.");
    }
  };

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
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Available Disclosures &amp; Reports</h1>
          <p className="text-sm text-slate-500">
            Showing {leafCount} of {totalLeafCount} results
          </p>
        </div>
        <button
          onClick={() => show("Autofill is coming soon.")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          title="Autofill from connected data sources"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Autofill
        </button>
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
        {filteredEntries.map((entry) => {
          if (isGroup(entry)) {
            const forceOpen = !!search.trim();
            const open = forceOpen || (openGroups[entry.id] ?? false);
            return (
              <GroupRow
                key={entry.id}
                group={entry}
                open={open}
                onToggle={() =>
                  setOpenGroups((prev) => ({ ...prev, [entry.id]: !open }))
                }
                onExport={handleExport}
                mounted={mounted}
              />
            );
          }
          const f = entry as FrameworkSummary;
          return <Row key={f.id} f={f} onExport={() => handleExport(f)} mounted={mounted} />;
        })}
        {filteredEntries.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No frameworks match your filters.
          </div>
        )}
      </div>

      <BrsrEnvironmentExportDialog
        open={envExportOpen}
        onClose={() => setEnvExportOpen(false)}
      />
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

function Row({
  f,
  onExport,
  nested = false,
  mounted = false,
}: {
  f: FrameworkSummary;
  onExport: () => void;
  nested?: boolean;
  mounted?: boolean;
}) {
  const progress = mounted ? computeProgress(f) : { pct: 0, completed: 0, total: 0, lastUpdated: undefined as string | undefined };
  const { pct, lastUpdated } = progress;
  const isActive = f.status === "active";
  // Export-only rows have no questionnaire behind them: nothing to link to, and
  // a 0% bar would read as "unstarted" rather than "not applicable".
  const exportOnly = f.variant === "export-only";
  return (
    <div
      className={`grid grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60 ${
        nested ? "bg-slate-50/40" : ""
      }`}
    >
      <div className={`flex items-center gap-3 ${nested ? "pl-8" : ""}`}>
        {nested ? (
          <span className="h-6 w-6 shrink-0 grid place-items-center text-slate-300">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6v8a3 3 0 0 0 3 3h6" strokeLinecap="round" />
            </svg>
          </span>
        ) : f.logoSrc ? (
          <img
            src={f.logoSrc}
            alt={`${f.shortName} logo`}
            className="h-10 w-10 shrink-0 rounded-md object-contain bg-white border border-slate-100"
          />
        ) : f.logoIcon === "report" ? (
          <div
            className={`h-10 w-10 shrink-0 rounded-md grid place-items-center ${f.logoColor}`}
          >
            <ReportIcon className="h-5 w-5" />
          </div>
        ) : (
          <div
            className={`h-10 w-10 shrink-0 rounded-md grid place-items-center text-[10px] font-bold ${f.logoColor}`}
          >
            {f.logoInitials}
          </div>
        )}
        <div className="min-w-0">
          {isActive && !exportOnly ? (
            <Link href={`/report/${f.id}`} className="font-medium text-slate-900 hover:underline">
              {f.shortName}
            </Link>
          ) : (
            <span className={`font-medium ${isActive ? "text-slate-900" : "text-slate-700"}`}>
              {f.shortName}
            </span>
          )}
          {f.name && f.name !== f.shortName && (
            <div className="text-xs text-slate-600">{f.name}</div>
          )}
          <div className="text-xs text-slate-500">
            {f.cadence}
            {!isActive && <span className="ml-2 text-slate-400">· Coming soon</span>}
            {exportOnly && <span className="ml-2 text-slate-400">· Export only</span>}
          </div>
        </div>
      </div>
      <div className="pr-4 text-sm text-slate-600 line-clamp-2">{f.description}</div>
      <div>
        {exportOnly ? (
          <span className="text-sm text-slate-400" title="Coverage is shown when you export">
            —
          </span>
        ) : isActive ? (
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
        {isActive && mounted ? formatUpdated(lastUpdated) : ""}
        {AUTOFILLED_IDS.has(f.id) && (
          <div className="mt-0.5 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            Autofilled on 12/02/2026
          </div>
        )}
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

// Generic mark for reports that aren't published by a named body, so there's no
// logo to show.
function ReportIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

function GroupRow({
  group,
  open,
  onToggle,
  onExport,
  mounted = false,
}: {
  group: FrameworkGroup;
  open: boolean;
  onToggle: () => void;
  onExport: (f: FrameworkSummary) => void;
  mounted?: boolean;
}) {
  const activeChildren = group.children.filter((c) => c.status === "active");
  const totalQ = activeChildren.reduce(
    (n, c) => n + (c.sections?.reduce((m, s) => m + s.questions.length, 0) ?? 0),
    0,
  );
  let completedQ = 0;
  let lastUpdated: string | undefined;
  if (mounted) {
    for (const c of activeChildren) {
      const p = computeProgress(c);
      completedQ += p.completed;
      if (p.lastUpdated && (!lastUpdated || p.lastUpdated > lastUpdated)) {
        lastUpdated = p.lastUpdated;
      }
    }
  }
  const pct = totalQ === 0 ? 0 : Math.round((completedQ / totalQ) * 100);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="grid w-full grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] items-center px-5 py-4 text-left hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {group.logoSrc ? (
            <img
              src={group.logoSrc}
              alt={`${group.shortName} logo`}
              className="h-10 w-10 shrink-0 rounded-md object-contain bg-white border border-slate-100"
            />
          ) : (
            <div
              className={`h-10 w-10 shrink-0 rounded-md grid place-items-center text-[10px] font-bold ${group.logoColor}`}
            >
              {group.logoInitials}
            </div>
          )}
          <div className="min-w-0">
            <span className="font-medium text-slate-900">{group.shortName}</span>
            {group.name && group.name !== group.shortName && (
              <div className="text-xs text-slate-600">{group.name}</div>
            )}
            <div className="text-xs text-slate-500">
              {group.cadence}
              <span className="ml-2 text-slate-400">
                · {group.children.length} {group.children.length === 1 ? "report" : "reports"}
              </span>
            </div>
          </div>
        </div>
        <div className="pr-4 text-sm text-slate-600 line-clamp-2">{group.description}</div>
        <div>
          <div className="text-sm font-medium text-slate-900">{pct}%</div>
          <div className="mt-1 h-1 w-24 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="text-sm text-slate-600">
          {mounted ? formatUpdated(lastUpdated) : ""}
          {group.children.some((c) => AUTOFILLED_IDS.has(c.id)) && (
            <div className="mt-0.5 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Autofilled on 12/02/2026
            </div>
          )}
        </div>
        <div />
      </button>
      {open &&
        group.children.map((c) => (
          <Row key={c.id} f={c} onExport={() => onExport(c)} nested mounted={mounted} />
        ))}
    </div>
  );
}
