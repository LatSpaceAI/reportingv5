import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Gate every page behind the demo login. Running this as middleware (rather
// than a check inside a layout) means an unauthenticated request is redirected
// before any protected markup is rendered or streamed, so there's no flash of
// the app shell before the redirect lands.
//
// This is demo-grade: the cookie is unsigned, so its presence alone is what's
// being checked here. See [[auth]] for what that does and doesn't buy.

const PUBLIC_PATHS = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.includes(pathname)) {
    // Already signed in — don't show the login page again.
    if (signedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!signedIn) {
    const url = new URL("/login", req.url);
    // Remember where they were headed so login can send them back.
    const from = `${pathname}${search}`;
    if (from !== "/") url.searchParams.set("from", from);
    return NextResponse.redirect(url);
  }

  // Signed in. Mark protected pages uncacheable so the browser can't restore a
  // signed-in view from its back/forward cache after the user logs out — the
  // back button must re-hit this middleware and get bounced to /login.
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  // Everything except Next internals, the auth API routes (login/logout must be
  // reachable while signed out), and static asset files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|txt|xlsx|docx)$).*)"],
};
