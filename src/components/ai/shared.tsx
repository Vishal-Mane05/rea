"use client";

import { useEffect, useState } from "react";

export const AI_SETUP_HINT = "Add ANTHROPIC_API_KEY to apps/web/.env to enable AI";

let statusPromise: Promise<boolean> | null = null;

/** Whether the server has an Anthropic key; null while loading. Fetched once per page load. */
export function useAiConfigured() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    statusPromise ??= fetch("/api/ai/status")
      .then((r) => r.json())
      .then((s: { configured: boolean }) => s.configured)
      .catch(() => false);
    statusPromise.then(setConfigured);
  }, []);
  return configured;
}

/** POST JSON and surface the server's `message` on failure. */
export async function aiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? (json.error === "invalid_body" ? "Please check the form fields" : `Request failed (${res.status})`));
  return json as T;
}

export function SetupHint({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ${className}`}>
      {AI_SETUP_HINT}, then restart the dev server.
    </p>
  );
}
