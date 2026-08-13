import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

// The login route sits outside the (shell) group so it renders without the
// sidenav — a signed-out visitor shouldn't see the app chrome at all.

export const metadata = {
  title: "Sign in — LatSpace",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
