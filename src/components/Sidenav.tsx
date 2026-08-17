"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  AI_CONTEXT_UPDATED_EVENT,
  clearAiContextCache,
  loadAiContext,
  readAiContext,
} from "@/lib/aiContext";

// A nav item is either a real route (`href`) or a placeholder that isn't wired
// up yet (`href` omitted). Placeholders render as disabled buttons so the chrome
// is in place while the destinations are still being defined. An item may also
// carry `children` — sub-routes shown indented under a collapsible parent.
interface NavItem {
  key: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavItem[];
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

// lucide: book-open
const LogbookIcon = (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
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
  { key: "dashboard", label: "Dashboard", href: "/", icon: DashboardIcon },
  {
    key: "data-collection",
    label: "Data Collection",
    href: "/data-collection",
    icon: DataCollectionIcon,
    children: [{ key: "logbook", label: "Logbook", href: "/logbook", icon: LogbookIcon }],
  },
  { key: "reporting", label: "Reporting", href: "/reporting", icon: ReportingIcon },
];

const COLLAPSE_KEY = "sidenav:collapsed";
const DATA_COLLECTION_EXPANDED_KEY = "sidenav:data-collection-expanded";

// A nav item is active when its own route matches; reporting and data-collection
// own subtrees, so they stay highlighted as the user drills in.
function itemMatchesRoute(it: NavItem, pathname: string): boolean {
  if (it.key === "reporting") return isReportingRoute(pathname);
  if (it.key === "data-collection")
    return pathname === "/data-collection" || pathname.startsWith("/data-collection/");
  return it.href ? pathname === it.href : false;
}

// Reporting owns /reporting and its sub-routes (e.g. /table, /report/[id]), so
// the highlight persists as the user drills into a framework. Note /report
// would also prefix-match /reporting; both belong to this item either way.
function isReportingRoute(pathname: string): boolean {
  return pathname.startsWith("/reporting") || pathname.startsWith("/table") || pathname.startsWith("/report");
}

export function Sidenav({
  userName,
  orgName: initialOrgName,
}: { userName?: string; orgName?: string } = {}) {
  const pathname = usePathname();
  const router = useRouter();
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

  // Sign out.
  //
  // The route clears the cookie on its own, but clearing it is only half the
  // job: the App Router keeps already-rendered segments in a client-side cache,
  // and the browser keeps the old document in its back/forward cache. A plain
  // redirect can therefore repaint the signed-in shell even though the session
  // is gone. So we clear the cookie, drop the router cache, and then leave via a
  // URL the bfcache has no entry for — the `?signedout=1` query is never served
  // from cache, which forces a real request that the middleware sees.
  async function onLogout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Grab the form now: React nulls currentTarget once the handler returns, so
    // reading it after an await (i.e. in the catch) would throw.
    const form = e.currentTarget;
    // Drop the cached company identity before anything can navigate away: the
    // profile is per-account, and the next person to sign in on this browser
    // must not see the last one's branding while their own profile loads. Done
    // up front so the native-form fallback below clears it too.
    clearAiContextCache();
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        redirect: "manual",
        // Without this the cookie jar isn't necessarily updated on some setups.
        credentials: "same-origin",
      });
      if (!res.ok && res.type !== "opaqueredirect") throw new Error("logout failed");
    } catch {
      // Network or server failure — fall back to the native form POST, which
      // performs the same logout without needing JS.
      form.submit();
      return;
    }
    // Tear down the App Router's cached segments before navigating away.
    router.refresh();
    window.location.href = "/login?signedout=1";
  }

  function isActive(it: NavItem): boolean {
    return itemMatchesRoute(it, pathname);
  }

  // Whether a child route of the given parent is currently active (used to keep
  // the group auto-expanded and to highlight the parent when a child is open).
  function hasActiveChild(it: NavItem): boolean {
    return (it.children ?? []).some((c) => itemMatchesRoute(c, pathname));
  }

  // Expand/collapse state for the Data Collection group. Defaults open when on
  // one of its routes (or a child route); the user's manual toggle is persisted.
  const [dcExpanded, setDcExpanded] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(DATA_COLLECTION_EXPANDED_KEY);
    } catch {}
    const onGroupRoute =
      pathname === "/data-collection" ||
      pathname.startsWith("/data-collection/") ||
      pathname === "/logbook";
    setDcExpanded(stored === null ? onGroupRoute : stored === "1");
    // run once on mount; route-driven auto-expand handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand when navigating into the group so the active child is visible.
  useEffect(() => {
    if (
      pathname === "/data-collection" ||
      pathname.startsWith("/data-collection/") ||
      pathname === "/logbook"
    ) {
      setDcExpanded(true);
    }
  }, [pathname]);

  const toggleDc = () => {
    setDcExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DATA_COLLECTION_EXPANDED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const aiActive = pathname === "/ai-context" || pathname.startsWith("/ai-context/");

  // The org label below reflects the company name saved against the signed-in
  // account. The server renders it into `initialOrgName` so it's correct on the
  // first paint; from there we keep it in sync with edits made on the AI
  // Context page, which fire AI_CONTEXT_UPDATED_EVENT after writing the cache.
  //
  // A cached name only wins when it isn't empty: a fresh browser has no cache,
  // and blanking a correct server-rendered label back to "Your Organization"
  // is exactly the bug this is here to avoid.
  const [orgName, setOrgName] = useState<string>(initialOrgName ?? "");
  useEffect(() => {
    const sync = () => {
      const cached = readAiContext()?.companyName?.trim();
      if (cached) setOrgName(cached);
    };
    sync();
    window.addEventListener(AI_CONTEXT_UPDATED_EVENT, sync);
    return () => window.removeEventListener(AI_CONTEXT_UPDATED_EVENT, sync);
  }, [pathname]);

  // Warm the cache from the server once per mount, so a browser that has never
  // seen this account (or whose storage was cleared) still gets the company
  // identity — and so the dashboard banner has it before it renders.
  useEffect(() => {
    void loadAiContext();
  }, []);

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
          const childActive = hasActiveChild(it);
          const base =
            "flex items-center cursor-pointer py-3 mb-1 text-[14px] font-medium tracking-[-0.01em] transition-all duration-200 rounded-[6px] overflow-hidden px-3";
          const state =
            active || childActive
              ? "text-[#074D47] bg-[#074D47]/[0.04]"
              : "text-[#0A0A0A]/60 hover:text-[#074D47] hover:bg-[#074D47]/[0.02] hover:underline";

          const iconColor = active || childActive ? "text-[#074D47]" : "text-[#0A0A0A]/40";
          const labelCls = `overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
            collapsed ? "ml-0 max-w-0 opacity-0" : "ml-4 max-w-[120px] opacity-100"
          }`;

          // ── Parent with children (e.g. Data Collection → Logbook) ──────────
          if (it.children && it.children.length > 0) {
            const expanded = dcExpanded;
            return (
              <div key={it.key}>
                <div className={`${base} ${state} pr-1`}>
                  {/* Parent route link */}
                  <Link
                    href={it.href ?? "#"}
                    title={collapsed ? it.label : undefined}
                    aria-label={it.label}
                    className="flex min-w-0 flex-1 items-center overflow-hidden"
                  >
                    <div className={`flex w-6 flex-shrink-0 justify-center ${iconColor}`}>{it.icon}</div>
                    <span className={labelCls}>{it.label}</span>
                  </Link>
                  {/* Collapse/expand chevron (hidden when the rail is collapsed) */}
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={toggleDc}
                      aria-label={expanded ? `Collapse ${it.label}` : `Expand ${it.label}`}
                      aria-expanded={expanded}
                      className="flex-shrink-0 rounded-[4px] p-1 text-[#0A0A0A]/40 transition-colors hover:bg-[#0A0A0A]/[0.04] hover:text-[#074D47]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Children — indented when expanded; icon-only when the rail is collapsed */}
                {(collapsed ? childActive : expanded) && (
                  <div className={collapsed ? "mb-1" : "mb-1 ml-4 border-l border-[#0A0A0A]/[0.06] pl-2"}>
                    {it.children.map((child) => {
                      const cActive = isActive(child);
                      const cState = cActive
                        ? "text-[#074D47] bg-[#074D47]/[0.04]"
                        : "text-[#0A0A0A]/55 hover:text-[#074D47] hover:bg-[#074D47]/[0.02]";
                      const cIconColor = cActive ? "text-[#074D47]" : "text-[#0A0A0A]/40";
                      return (
                        <Link
                          key={child.key}
                          href={child.href ?? "#"}
                          title={collapsed ? child.label : undefined}
                          aria-label={child.label}
                          className={`flex items-center overflow-hidden rounded-[6px] px-3 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-all duration-200 ${cState} ${
                            collapsed ? "justify-center" : ""
                          }`}
                        >
                          <div className={`flex w-5 flex-shrink-0 justify-center ${cIconColor}`}>{child.icon}</div>
                          <span className={labelCls}>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // ── Leaf route ─────────────────────────────────────────────────────
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

          // ── Disabled placeholder ───────────────────────────────────────────
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
            {userName || "Signed in"}
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
        {/* The form still posts to the route so logout works without client JS.
            With JS we intercept: the App Router keeps a client-side cache of
            already-rendered segments, and a redirect alone can leave the signed-in
            shell painted from that cache. Clearing the cookie and then hard-setting
            location tears the cache down with the document. */}
        <form action="/api/auth/logout" method="post" onSubmit={onLogout}>
          {collapsed ? (
            <button
              type="submit"
              aria-label="Log out"
              title="Log out"
              className="flex w-full items-center justify-center rounded-[6px] p-2 text-[#0A0A0A]/80 transition-all duration-200 hover:bg-[#0A0A0A]/[0.04] hover:text-[#074D47]"
            >
              <LogoutIcon className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <button
              type="submit"
              className="flex w-full items-center gap-2 overflow-hidden whitespace-nowrap border border-[#0A0A0A]/20 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-[#0A0A0A]/80 transition-all duration-200 hover:border-[#074D47]/50 hover:text-[#074D47]"
            >
              <div className="ml-[-4px] flex w-4 flex-shrink-0 justify-center">
                <LogoutIcon className="h-[14px] w-[14px]" />
              </div>
              <span className="ml-2 max-w-[100px] overflow-hidden opacity-100">Logout</span>
            </button>
          )}
        </form>
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
