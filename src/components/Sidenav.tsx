"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavChild {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  children?: NavChild[];
}

const items: NavItem[] = [
  {
    href: "/",
    label: "Reporting",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <rect x="7" y="10" width="3" height="8" />
        <rect x="12" y="6" width="3" height="12" />
        <rect x="17" y="13" width="3" height="5" />
      </svg>
    ),
    children: [
      { href: "/table", label: "Assignees" },
    ],
  },
];

export function Sidenav() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Auto-open a group when one of its children is the active route.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const it of items) {
        if (it.children?.some((c) => c.href === pathname) && !next[it.href]) {
          next[it.href] = true;
        }
      }
      return next;
    });
  }, [pathname]);

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <Image
          src="/latspace-logo.svg"
          alt="LatSpace"
          width={28}
          height={28}
          priority
        />
        <span className="font-semibold tracking-tight text-slate-900">LatSpace</span>
      </div>
      <nav className="flex-1 px-2 py-2 space-y-1">
        {items.map((it) => {
          const active = pathname === it.href;
          const hasChildren = !!it.children?.length;
          const childActive = it.children?.some((c) => c.href === pathname) ?? false;
          const open = openGroups[it.href] ?? childActive;

          return (
            <div key={it.href}>
              <div
                className={`group flex items-center gap-1 rounded-md text-sm ${
                  active
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [it.href]: !open }))
                    }
                    aria-label={open ? `Collapse ${it.label}` : `Expand ${it.label}`}
                    className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : (
                  <span className="ml-1 w-[22px] shrink-0" aria-hidden />
                )}
                <Link
                  href={it.href}
                  className="flex flex-1 items-center gap-3 rounded-md px-2 py-2"
                >
                  {it.icon}
                  {it.label}
                </Link>
              </div>
              {hasChildren && open && (
                <div className="mt-1 ml-7 space-y-1 border-l border-slate-100 pl-2">
                  {it.children!.map((c) => {
                    const cActive = pathname === c.href;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`block rounded-md px-3 py-1.5 text-sm ${
                          cActive
                            ? "bg-slate-100 text-slate-900 font-medium"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {c.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4 text-[11px] text-slate-400">
        Reporting Module
        <div>v1.0.0</div>
      </div>
    </aside>
  );
}
