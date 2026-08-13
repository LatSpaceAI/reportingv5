import { cookies } from "next/headers";
import { Sidenav } from "@/components/Sidenav";
import { ToastProvider } from "@/components/Toast";
import { accountById, SESSION_COOKIE } from "@/lib/auth";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  // Middleware guarantees a session cookie on these routes, so the lookup only
  // falls through if the demo account list changed under a live cookie.
  const account = accountById(cookies().get(SESSION_COOKIE)?.value);

  return (
    <ToastProvider>
      <div className="flex h-full">
        <Sidenav userName={account?.name} />
        <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </ToastProvider>
  );
}
