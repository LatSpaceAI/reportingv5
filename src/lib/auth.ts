// Demo authentication.
//
// This is a stand-in, not real auth. The accounts are hard-coded below, every
// account shares one password read from DEMO_PASSWORD, and the session cookie
// holds nothing but the account id — there is no password hashing, no signing,
// and no server-side session store, so anyone who can set a cookie can walk in.
// It exists so the app has a front door for demos and so the identity plumbing
// (who is signed in, what they see in the sidebar) has a real shape to grow into.
//
// When real auth arrives, replace `verifyCredentials` with a call to the
// identity provider and swap SESSION_COOKIE for a signed/encrypted session.
// The rest of the app only reads `DemoAccount`, so the surface to change is
// small — see [[currentUser]] for the identity the entry model writes.
//
// The accepted addresses and the password are documented in .env.local.example.

export interface DemoAccount {
  /** Stored in the session cookie; also used as input_value.entered_by. */
  id: string;
  email: string;
  name: string;
  role: string;
  organization: string;
}

/**
 * The shared demo password. Set DEMO_PASSWORD in .env.local to change it; the
 * fallback keeps a fresh clone working without any env setup. Server-only —
 * this module is imported by the login route and middleware, never shipped to
 * the browser, so the value is not exposed to the client.
 */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "birla-estates";

/** The accounts the login page accepts. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "esg-team",
    email: "esg@demo.com",
    name: "Rahul Ravi",
    role: "Central ESG",
    organization: "Birla Estates",
  },
  {
    id: "site-lead",
    email: "site@latspace.in",
    name: "Site Lead",
    role: "Site Reporting",
    organization: "Birla Estates",
  },
];

export const SESSION_COOKIE = "latspace_session";

/**
 * The account auto sign-in uses, when it is switched on.
 *
 * Auto sign-in exists so a shared demo link lands the visitor in the app rather
 * than on a login form they have no credentials for. It is OFF by default: with
 * it on, signing out and returning — or simply reopening the app — silently
 * mints a new session, which reads as "logout is broken". Set
 * DEMO_AUTO_SIGN_IN=on to opt a demo deployment back into it.
 *
 * When real auth arrives this whole mechanism goes away.
 */
export const AUTO_SIGN_IN_ACCOUNT_ID = "esg-team";

export const AUTO_SIGN_IN_ENABLED = process.env.DEMO_AUTO_SIGN_IN === "on";

/**
 * Set by logout to suppress auto sign-in. Without it, signing out would drop
 * the session and the very next navigation would silently issue a new one —
 * logout would look broken. The marker is cleared when someone signs in
 * explicitly, so it only survives as long as the user stays signed out.
 */
export const SIGNED_OUT_COOKIE = "latspace_signed_out";

/**
 * Cookie attributes for the demo session. Shared by the login route and the
 * middleware's auto sign-in so the two can't drift apart. httpOnly so page
 * scripts can't read it; sameSite=lax so it survives redirects.
 *
 * Deliberately NO maxAge/expires: that makes it a session cookie, so closing
 * the browser ends the session and the next visit has to sign in again. A
 * dated cookie kept people signed in for days and made the app look like it
 * never logs anyone out.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/**
 * Attributes for cookies that must outlive the browser session — currently only
 * the signed-out marker, which has to survive a restart or auto sign-in (when
 * enabled) would undo an explicit logout. 7 days.
 */
export const PERSISTENT_COOKIE_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 60 * 60 * 24 * 7,
} as const;

/**
 * Match an email/password pair against the demo accounts. Email comparison is
 * case-insensitive and trimmed (people paste with stray whitespace); the
 * password must match DEMO_PASSWORD exactly. Returns null when nothing matches
 * — callers should not distinguish "no such user" from "wrong password" in the
 * message they show.
 */
export function verifyCredentials(email: string, password: string): DemoAccount | null {
  if (password !== DEMO_PASSWORD) return null;
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === normalized) ?? null;
}

/** Look up an account by the id stored in the session cookie. */
export function accountById(id: string | undefined): DemoAccount | null {
  if (!id) return null;
  return DEMO_ACCOUNTS.find((a) => a.id === id) ?? null;
}
