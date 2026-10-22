"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SetupHint, useAiConfigured } from "./shared";

const languages = [
  ["en", "English"],
  ["nl", "Dutch"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["hi", "Hindi"],
] as const;

const MAX_SOURCE = 100_000;

type Phase = { kind: "form" } | { kind: "working"; sections: number; chars: number; saving: boolean } | { kind: "error"; message: string };

export function GenerateCourseDialog({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const router = useRouter();
  const configured = useAiConfigured();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sectionCount, setSectionCount] = useState(3);
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [languageCode, setLanguageCode] = useState("en");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  async function loadFile(file: File) {
    const text = await file.text();
    setSourceText(text.slice(0, MAX_SOURCE));
  }

  async function generate() {
    setPhase({ kind: "working", sections: 0, chars: 0, saving: false });
    const language = languages.find(([c]) => c === languageCode)?.[1] ?? "English";
    try {
      const res = await fetch("/api/ai/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, sourceText, sectionCount, includeQuiz, language, languageCode }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? (json.error === "invalid_body" ? "Describe the course in a few more words" : `Request failed (${res.status})`));
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          if (!raw.startsWith("data: ")) continue;
          const ev = JSON.parse(raw.slice(6));
          if (ev.type === "progress") setPhase({ kind: "working", sections: ev.sections, chars: ev.chars, saving: false });
          else if (ev.type === "saving") setPhase((p) => (p.kind === "working" ? { ...p, saving: true } : p));
          else if (ev.type === "done") return router.push(`/courses/${ev.id}`);
          else if (ev.type === "error") throw new Error(ev.message);
        }
      }
      throw new Error("The connection closed before the course was ready — try again");
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong" });
    }
  }

  const working = phase.kind === "working";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={working ? undefined : onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!working && (
              <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800">
                ← Templates
              </button>
            )}
            <h2 className="text-xl font-semibold">✨ Generate a course with AI</h2>
          </div>
          {!working && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
              ✕
            </button>
          )}
        </div>

        {configured === false && <SetupHint className="mb-4" />}

        {working ? (
          <div className="py-10 text-center">
            <div className="mx-auto size-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            <p className="mt-4 font-medium">{phase.saving ? "Saving your course…" : "Writing your course…"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {phase.sections > 0
                ? `${phase.sections} of ${sectionCount} section${sectionCount === 1 ? "" : "s"} drafted`
                : "Planning the structure — this usually takes a minute or two."}
            </p>
            <div className="mx-auto mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${phase.saving ? 100 : Math.min(95, 5 + (phase.sections / sectionCount) * 90)}%` }}
              />
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <label className="block">
              <span className="text-sm font-medium">What should learners be able to do after this course?</span>
              <textarea
                required
                minLength={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                placeholder="e.g. Recognise and report phishing emails"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Audience</span>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. New sales hires, no technical background"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Source material (optional)</span>
                <label className="cursor-pointer text-xs text-brand-600 hover:underline">
                  Upload .txt / .md
                  <input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
                </label>
              </div>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value.slice(0, MAX_SOURCE))}
                rows={5}
                placeholder="Paste a policy, manual, notes or slide text — the course will be based on it."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-brand-500"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {sourceText.length.toLocaleString()} / {MAX_SOURCE.toLocaleString()} characters
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium">Sections</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={sectionCount}
                  onChange={(e) => setSectionCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Language</span>
                <select
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  {languages.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" checked={includeQuiz} onChange={(e) => setIncludeQuiz(e.target.checked)} className="size-4 accent-brand-600" />
                Include quiz questions
              </label>
            </div>
            {phase.kind === "error" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{phase.message}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={configured === false || topic.trim().length < 3}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Generate course
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
