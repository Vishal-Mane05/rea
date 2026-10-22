"use client";

import Link from "next/link";
import { useState } from "react";

type Mode = "login" | "signup";

const copy = {
  login: { title: "Welcome back", cta: "Log in", alt: "No account yet?", altLink: "Create one", altHref: "/signup" },
  signup: { title: "Create your account", cta: "Sign up", alt: "Already have an account?", altLink: "Log in", altHref: "/login" },
};

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const c = copy[mode];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    if (res?.ok) {
      // full navigation so server components pick up the new cookie
      window.location.assign(next);
      return;
    }
    const data = await res?.json().catch(() => null);
    setError(data?.issues?.[0]?.message ?? data?.error ?? "Something went wrong. Please try again.");
    setBusy(false);
  }

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">L</span>
          <span className="text-lg font-semibold">LearnForge</span>
        </div>
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold">{c.title}</h1>
          {mode === "signup" && (
            <label className="mb-3 block text-sm font-medium text-slate-700">
              Name
              <input name="name" required autoComplete="name" className={input} />
            </label>
          )}
          <label className="mb-3 block text-sm font-medium text-slate-700">
            Email
            <input name="email" type="email" required autoComplete="email" className={input} />
          </label>
          <label className="mb-4 block text-sm font-medium text-slate-700">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={input}
            />
          </label>
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Please wait…" : c.cta}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {c.alt}{" "}
          <Link href={`${c.altHref}?next=${encodeURIComponent(next)}`} className="font-medium text-brand-600 hover:underline">
            {c.altLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
