"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { clearAiContextCache } from "@/lib/aiContext";

// Demo sign-in. The credentials this accepts are documented in
// .env.local.example rather than shown on the page. See [[auth]].

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where the middleware bounced them from, so we can land them back there.
  const from = searchParams.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Sign in failed. Try again.");
        setSubmitting(false);
        return;
      }
      // The AI Context cache belongs to whoever was signed in last — which may
      // not be the account that just signed in (a closed browser ends the
      // session without ever running logout). Drop it so the shell loads this
      // account's own company name and logo instead of the previous one's.
      clearAiContextCache();
      // Full navigation rather than router.push: the middleware needs to see
      // the new cookie, and a refresh guarantees the shell mounts signed in.
      router.replace(from);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full border-2 border-brand bg-white px-4 py-3 text-[15px] text-[#0A0A0A] outline-none transition-shadow placeholder:text-[#0A0A0A]/30 focus:ring-2 focus:ring-brand/20";
  const labelCls =
    "mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-[#0A0A0A]/70";

  return (
    <div className="flex min-h-full items-center justify-center bg-[#FAFAFA] px-6 py-12">
      <div className="w-full max-w-[500px] border border-[#0A0A0A]/[0.08] bg-white px-14 py-12">
        {/* Brand — logo stacked over the wordmark, centred. */}
        <div className="flex flex-col items-center">
          <Image src="/latspace-logo.svg" alt="" width={64} height={64} priority />
          <h1 className="mt-6 text-[26px] font-semibold tracking-[-0.02em] text-[#0A0A0A]">
            LatSpace
          </h1>
          <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.16em] text-brand">
            ESG Data Management System
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-12">
          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
            className={inputCls}
          />

          <label htmlFor="password" className={labelCls + " mt-6"}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={inputCls + " pr-12"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#0A0A0A]/40 transition-colors hover:text-brand"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full bg-brand px-4 py-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

// lucide: eye
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// lucide: eye-off
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
