import { Sidenav } from "@/components/Sidenav";

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <Sidenav />
      <div className="flex-1 overflow-y-auto bg-white">{children}</div>
    </div>
  );
}
