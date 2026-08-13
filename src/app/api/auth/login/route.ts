import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, verifyCredentials } from "@/lib/auth";

// Demo login. Verifies the email/password against the hard-coded accounts in
// @/lib/auth and sets the session cookie. httpOnly so page scripts can't read
// it; sameSite=lax so it survives the post-login redirect.

export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const account = verifyCredentials(email, password);
  if (!account) {
    // Deliberately vague: don't reveal which half was wrong.
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const res = NextResponse.json({
    user: { id: account.id, name: account.name, role: account.role, organization: account.organization },
  });
  res.cookies.set(SESSION_COOKIE, account.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
