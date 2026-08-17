import { cookies } from "next/headers";
import { Sidenav } from "@/components/Sidenav";
import { ToastProvider } from "@/components/Toast";
import { getAiContextProfile } from "@/lib/aiContextRepo";
import { accountById, SESSION_COOKIE } from "@/lib/auth";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware guarantees a session cookie on these routes, so the lookup only
  // falls through if the demo account list changed under a live cookie.
  const account = accountById(cookies().get(SESSION_COOKIE)?.value);

  // The company name saved against this account. Resolved here rather than
  // left to the client so the sidebar's org label is right on the first paint,
  // including on a browser that has never signed in as this account. Falls
  // back to the organization on the credentials, then to the client's cache.
  // A DB outage must not take the whole shell down — the sidebar hydrates from
  // its own fetch, so an empty label here is recoverable.
  let orgName = account?.organization ?? "";
  if (account) {
    try {
      const profile = await getAiContextProfile(account.id);
      if (profile?.companyName.trim()) orgName = profile.companyName.trim();
    } catch {
      // keep the credential's organization
    }
  }

  return (
    <ToastProvider>
      <div className="flex h-full">
        <Sidenav userName={account?.name} orgName={orgName} />
        <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </ToastProvider>
  );
}
