import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SIGNED_OUT_COOKIE } from "@/lib/auth";

// Clears the demo session cookie. POST-only so a stray link prefetch or an
// <img> can't sign the user out.

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  // Suppress the middleware's auto sign-in, which would otherwise hand this
  // visitor a new session on their next navigation. Cleared on explicit login.
  res.cookies.set(SIGNED_OUT_COOKIE, "1", SESSION_COOKIE_OPTIONS);
  return res;
}
