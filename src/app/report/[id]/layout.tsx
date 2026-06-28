import { Sidenav } from "@/components/Sidenav";

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <Sidenav />
      {/* Report screens (Questionnaire / QualitativeReport) are full-height
          flex columns that own their internal scrolling, so the main pane
          stays overflow-hidden to avoid a second scrollbar. */}
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {children}
      </main>
    </div>
  );
}
