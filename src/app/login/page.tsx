import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

// The login route sits outside the (shell) group so it renders without the
// sidenav — a signed-out visitor shouldn't see the app chrome at all.

export const metadata = {
  title: "Sign in — LatSpace",
};

// Never serve this from a cache: after signing out the browser must re-run the
// middleware rather than repaint a stored copy of the app shell.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
