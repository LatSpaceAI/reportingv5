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

/** How long a demo session lasts, in seconds (7 days). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

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
