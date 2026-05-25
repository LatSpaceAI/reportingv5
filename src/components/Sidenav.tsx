"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = { className?: string };

const DashboardIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7" rx="1.2" />
    <rect x="14" y="3" width="7" height="7" rx="1.2" />
    <rect x="3" y="14" width="7" height="7" rx="1.2" />
    <rect x="14" y="14" width="7" height="7" rx="1.2" />
  </svg>
);

const DataCollectionIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" strokeLinejoin="round" />
    <path d="M14 3v6h6" strokeLinejoin="round" />
    <path d="m10.5 13.5 2 2 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ReportingIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 16v-4M12 16V8M16 16v-6" strokeLinecap="round" />
  </svg>
);

const LeafIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 19c0-8 6-14 16-14 0 10-6 16-14 16-1 0-2-.1-2-.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 19c1-4 4-7 8-9" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      strokeLinejoin="round"
    />
  </svg>
);

const LogoutIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12H9" strokeLinecap="round" />
  </svg>
);

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  reportingPaths?: string[];
}

const items: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <DashboardIcon className="h-[18px] w-[18px]" />,
  },
  {
    key: "data-collection",
    label: "Data Collection",
    icon: <DataCollectionIcon className="h-[18px] w-[18px]" />,
  },
  {
    key: "reporting",
    label: "Reporting",
    icon: <ReportingIcon className="h-[18px] w-[18px]" />,
    reportingPaths: ["/", "/table"],
  },
  {
    key: "decarbonisation",
    label: "Decarbonisation",
    icon: <LeafIcon className="h-[18px] w-[18px]" />,
  },
];

export function Sidenav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[64px] shrink-0 flex-col items-center border-r border-slate-200 bg-white">
      <div className="flex w-full flex-col items-center gap-1 px-2 pt-4 pb-3">
        <Link href="/" aria-label="LatSpace">
          <Image src="/latspace-logo.svg" alt="LatSpace" width={26} height={26} priority />
        </Link>
        <span
          aria-hidden
          className="mt-2 p-1 text-slate-400"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className="w-full border-t border-slate-200" />
      <nav className="flex w-full flex-1 flex-col items-center gap-3 px-2 py-4">
        {items.map((it) => {
          const active = it.reportingPaths?.includes(pathname) ?? false;
          return (
            <div
              key={it.key}
              title={it.label}
              aria-label={it.label}
              className={`flex h-9 w-9 items-center justify-center rounded-md ${
                active ? "bg-emerald-50 text-emerald-700" : "text-slate-500"
              }`}
            >
              {it.icon}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto flex w-full flex-col items-center gap-2 border-t border-slate-200 px-2 py-3">
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Logout"
          title="Logout"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <LogoutIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
