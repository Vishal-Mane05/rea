"use client";

import { useState } from "react";
import type { Page } from "../types";
import { AI_SETUP_HINT, aiPost, useAiConfigured } from "./shared";

/** Panel on the section pane: writes N questions from the section's content pages. */
export function GenerateQuiz({ sectionId, onCreated }: { sectionId: string; onCreated: (pages: Page[]) => void }) {
  const configured = useAiConfigured();
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function generate() {
    setBusy(true);
    setMessage(null);
    try {
      const { pages } = await aiPost<{ pages: Page[] }>("/api/ai/generate-quiz", { sectionId, count });
      onCreated(pages);
      setMessage({ ok: true, text: `Added ${pages.length} question${pages.length === 1 ? "" : "s"} to the end of this section.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "AI request failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
      <p className="text-sm font-medium">✨ Generate a quiz from this section</p>
      <p className="mt-0.5 text-xs text-slate-500">Questions are written from the section&apos;s content pages and added at the end.</p>
      {configured === false ? (
        <p className="mt-3 text-xs text-amber-800">{AI_SETUP_HINT}</p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            aria-label="Number of questions"
          >
            {[1, 2, 3, 4, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n} question{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={busy || configured === null}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Writing questions…" : "Generate"}
          </button>
        </div>
      )}
      {message && <p className={`mt-2 text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
    </div>
  );
}
