"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AI_CONTEXT_UPDATED_EVENT, readAiContext } from "@/lib/aiContext";

// A nav item is either a real route (`href`) or a placeholder that isn't wired
// up yet (`href` omitted). Placeholders render as disabled buttons so the chrome
// is in place while the destinations are still being defined.
interface NavItem {
  key: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
}

// Icons mirror the Lucide React set called for in the LatSpace design language,
// drawn inline (18px, stroke-width 2) to stay consistent with the rest of the
// app's inline-SVG convention. Each comment names its Lucide source.

// lucide: layout-dashboard
const DashboardIcon = (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

// lucide: upload
const DataCollectionIcon = (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

// lucide: file-bar-chart
const ReportingIcon = (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M12 18v-4" />
    <path d="M8 18v-2" />
    <path d="M16 18v-6" />
  </svg>
);

const items: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { key: "data-collection", label: "Data Collection", icon: DataCollectionIcon },
  { key: "reporting", label: "Reporting", href: "/", icon: ReportingIcon },
];

const COLLAPSE_KEY = "sidenav:collapsed";

// Reporting owns the landing page and its sub-routes (e.g. /table). Mark it
// active for any of those so the highlight persists as the user drills in.
function isReportingRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/table") || pathname.startsWith("/report");
}

export function Sidenav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(COLLAPSE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed, hydrated]);

  function isActive(it: NavItem): boolean {
    if (it.key === "reporting") return isReportingRoute(pathname);
    return it.href ? pathname === it.href : false;
  }

  const aiActive = pathname === "/ai-context" || pathname.startsWith("/ai-context/");

  // The org label below reflects the company name saved on the AI Context page.
  // We read it on mount, on every route change (e.g. navigating away from the
  // editor), and when the page dispatches AI_CONTEXT_UPDATED_EVENT on save.
  const [orgName, setOrgName] = useState<string>("");
  useEffect(() => {
    const sync = () => setOrgName(readAiContext()?.companyName?.trim() ?? "");
    sync();
    window.addEventListener(AI_CONTEXT_UPDATED_EVENT, sync);
    return () => window.removeEventListener(AI_CONTEXT_UPDATED_EVENT, sync);
  }, [pathname]);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-[#0A0A0A]/[0.06] bg-white transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo + collapse */}
      <div className="flex h-24 flex-shrink-0 items-center justify-between overflow-hidden border-b border-[#0A0A0A]/[0.06] px-4">
        <Link href="/" aria-label="LatSpace" className="group flex items-center overflow-hidden">
          <div className="flex w-8 flex-shrink-0 justify-center">
            <Image
              src="/latspace-logo.svg"
              alt="LatSpace"
              width={32}
              height={32}
              className="transition-opacity duration-200 group-hover:opacity-80"
              priority
            />
          </div>
          <span
            className={`overflow-hidden whitespace-nowrap text-[18px] font-semibold tracking-[-0.01em] text-[#0A0A0A] transition-all duration-300 ease-in-out ${
              collapsed ? "ml-0 max-w-0 opacity-0" : "ml-3 max-w-[150px] opacity-100"
            }`}
          >
            LatSpace
          </span>
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="flex-shrink-0 rounded-[6px] p-1.5 transition-colors duration-200 hover:bg-[#0A0A0A]/[0.04]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0A0A0A]/60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      <div
        className={`flex justify-center overflow-hidden border-b border-[#0A0A0A]/[0.06] transition-all duration-300 ${
          collapsed ? "h-auto py-3 opacity-100" : "h-0 py-0 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="rounded-[6px] p-1.5 transition-colors duration-200 hover:bg-[#0A0A0A]/[0.04]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0A0A0A]/60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-12">
        {items.map((it) => {
          const active = isActive(it);
          const base =
            "flex items-center cursor-pointer py-3 mb-1 text-[14px] font-medium tracking-[-0.01em] transition-all duration-200 rounded-[6px] overflow-hidden px-3";
          const state = active
            ? "text-[#074D47] bg-[#074D47]/[0.04]"
            : "text-[#0A0A0A]/60 hover:text-[#074D47] hover:bg-[#074D47]/[0.02] hover:underline";

          const iconColor = active ? "text-[#074D47]" : "text-[#0A0A0A]/40";
          const labelCls = `overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
            collapsed ? "ml-0 max-w-0 opacity-0" : "ml-4 max-w-[120px] opacity-100"
          }`;

          if (it.href) {
            return (
              <Link
                key={it.key}
                href={it.href}
                title={collapsed ? it.label : undefined}
                aria-label={it.label}
                className={`${base} ${state}`}
              >
                <div className={`flex w-6 flex-shrink-0 justify-center ${iconColor}`}>{it.icon}</div>
                <span className={labelCls}>{it.label}</span>
              </Link>
            );
          }
          return (
            <button
              key={it.key}
              type="button"
              disabled
              title={collapsed ? `${it.label} (coming soon)` : "Coming soon"}
              aria-label={it.label}
              className={`${base} w-full cursor-not-allowed text-[#0A0A0A]/30 opacity-60`}
            >
              <div className="flex w-6 flex-shrink-0 justify-center text-[#0A0A0A]/30">{it.icon}</div>
              <span className={labelCls}>{it.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: org identity + logout */}
      <div
        className={`flex-shrink-0 border-t border-[#0A0A0A]/[0.06] transition-all duration-300 ${
          collapsed ? "p-3" : "p-8"
        }`}
      >
        <div
          className={`overflow-hidden transition-all duration-300 ${
            collapsed ? "mb-0 max-h-0 opacity-0" : "mb-6 max-h-20 opacity-100"
          }`}
        >
          <div className="mb-1 whitespace-nowrap text-[12px] font-semibold tracking-[0.02em] text-[#074D47]">
            Ishan Rahman
          </div>
          <div className="whitespace-nowrap text-[11px] uppercase tracking-[0.08em] text-[#0A0A0A]/70">
            {orgName || "Your Organization"}
          </div>
        </div>

        {/* AI Context — sits just above logout. */}
        {collapsed ? (
          <Link
            href="/ai-context"
            aria-label="AI Context"
            title="AI Context"
            className={`mb-3 flex w-full items-center justify-center rounded-[6px] p-2 transition-all duration-200 ${
              aiActive
                ? "bg-[#074D47]/[0.04] text-[#074D47]"
                : "text-[#0A0A0A]/80 hover:bg-[#0A0A0A]/[0.04] hover:text-[#074D47]"
            }`}
          >
            <SparklesIcon className="h-[18px] w-[18px]" />
          </Link>
        ) : (
          <Link
            href="/ai-context"
            aria-label="AI Context"
            className={`mb-3 flex w-full items-center gap-2 overflow-hidden whitespace-nowrap px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] transition-all duration-200 ${
              aiActive
                ? "bg-[#074D47]/[0.04] text-[#074D47]"
                : "text-[#0A0A0A]/80 hover:bg-[#0A0A0A]/[0.04] hover:text-[#074D47]"
            }`}
          >
            <div className="ml-[-4px] flex w-4 flex-shrink-0 justify-center">
              <SparklesIcon className="h-[14px] w-[14px]" />
            </div>
            <span className="ml-2 max-w-[100px] overflow-hidden opacity-100">
              AI Context
            </span>
          </Link>
        )}

        {/* TODO: add Settings icon here once a /settings route exists */}
        {collapsed ? (
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            className="flex w-full items-center justify-center rounded-[6px] p-2 text-[#0A0A0A]/80 transition-all duration-200 hover:bg-[#0A0A0A]/[0.04] hover:text-[#074D47]"
          >
            <LogoutIcon className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 overflow-hidden whitespace-nowrap border border-[#0A0A0A]/20 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-[#0A0A0A]/80 transition-all duration-200 hover:border-[#074D47]/50 hover:text-[#074D47]"
          >
            <div className="ml-[-4px] flex w-4 flex-shrink-0 justify-center">
              <LogoutIcon className="h-[14px] w-[14px]" />
            </div>
            <span className="ml-2 max-w-[100px] overflow-hidden opacity-100">Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}

// lucide: sparkles
function SparklesIcon({ className = "h-4 w-4" }: { className?: string }) {
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

// lucide: log-out
function LogoutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
