import { Sidenav } from "@/components/Sidenav";
import { ToastProvider } from "@/components/Toast";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-full">
        <Sidenav />
        <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </ToastProvider>
  );
}
