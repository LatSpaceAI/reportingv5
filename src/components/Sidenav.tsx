"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const items: NavItem[] = [
  {
    href: "/",
    label: "Disclosures & Reports",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <rect x="7" y="10" width="3" height="8" />
        <rect x="12" y="6" width="3" height="12" />
        <rect x="17" y="13" width="3" height="5" />
      </svg>
    ),
  },
  {
    href: "/table",
    label: "Table",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
      </svg>
    ),
  },
];

export function Sidenav() {
  const pathname = usePathname();
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
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {it.icon}
              {it.label}
            </Link>
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
