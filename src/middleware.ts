import { NextResponse, type NextRequest } from "next/server";
import {
  AUTO_SIGN_IN_ACCOUNT_ID,
  AUTO_SIGN_IN_ENABLED,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SIGNED_OUT_COOKIE,
} from "@/lib/auth";

// Session handling for every page. Running this as middleware (rather than a
// check inside a layout) means the session is resolved before any markup is
// rendered or streamed, so there's no flash of the wrong view.
//
// A visitor arriving without a session is signed in automatically as the demo
// account and lands on the page they asked for — someone opening a shared link
// shouldn't hit a login form they have no credentials for. Set
// DEMO_AUTO_SIGN_IN=off to restore the gate and bounce them to /login instead.
//
// This is demo-grade: the cookie is unsigned, so its presence alone is what's
// being checked here. See [[auth]] for what that does and doesn't buy.

const PUBLIC_PATHS = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.includes(pathname)) {
    // Already signed in — don't show the login page again. Reached by an
    // explicit visit to /login, which stays available for switching accounts.
    if (signedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!signedIn) {
    // Someone who signed out stays signed out until they sign in again —
    // otherwise the next navigation would hand them a fresh session and logout
    // would look broken.
    const signedOut = Boolean(req.cookies.get(SIGNED_OUT_COOKIE)?.value);

    if (!AUTO_SIGN_IN_ENABLED || signedOut) {
      const url = new URL("/login", req.url);
      // Remember where they were headed so login can send them back.
      const from = `${pathname}${search}`;
      if (from !== "/") url.searchParams.set("from", from);
      return NextResponse.redirect(url);
    }

    // Issue the demo session and let the request through in the same pass, so
    // the visitor gets the page they asked for with no redirect hop. The
    // request cookie is set too: this response is rendering the page now, and
    // server components read cookies off the request, not the response.
    req.cookies.set(SESSION_COOKIE, AUTO_SIGN_IN_ACCOUNT_ID);
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set(SESSION_COOKIE, AUTO_SIGN_IN_ACCOUNT_ID, SESSION_COOKIE_OPTIONS);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  }

  // Signed in. Mark protected pages uncacheable so the browser can't restore a
  // signed-in view from its back/forward cache after the user logs out — the
  // back button must re-hit this middleware.
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  // Everything except Next internals, the auth API routes (login/logout must be
  // reachable while signed out), and static asset files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|txt|xlsx|docx)$).*)"],
};
