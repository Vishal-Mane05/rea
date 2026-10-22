"use client";

import { DOMSerializer } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { AI_SETUP_HINT, aiPost, useAiConfigured } from "./shared";

const actions = [
  ["improve", "Improve writing"],
  ["shorter", "Make shorter"],
  ["longer", "Make longer"],
  ["simplify", "Simplify"],
  ["grammar", "Fix spelling & grammar"],
] as const;

type Action = (typeof actions)[number][0] | "translate" | "custom";

function selectedHtml(editor: Editor) {
  const { selection, schema } = editor.state;
  if (selection.empty) return null;
  const div = document.createElement("div");
  div.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(selection.content().content));
  return div.innerHTML;
}

/** "✨ AI" toolbar dropdown: rewrites the selection, or the whole text when nothing is selected. */
export function AiMenu({ editor }: { editor: Editor }) {
  const configured = useAiConfigured();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompting, setPrompting] = useState<"translate" | "custom" | null>(null);
  const [instruction, setInstruction] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && (setOpen(false), setPrompting(null));
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function run(action: Action, extra?: string) {
    const fragment = selectedHtml(editor);
    const source = fragment ?? editor.getHTML();
    if (!editor.getText().trim()) return setError("Write something first");
    const { from, to } = editor.state.selection;
    setBusy(true);
    setError(null);
    try {
      const { html } = await aiPost<{ html: string }>("/api/ai/rewrite", { html: source, action, instruction: extra });
      // one transaction, so a single undo restores the original
      const chain = editor.chain().focus();
      (fragment ? chain.setTextSelection({ from, to }) : chain.selectAll()).insertContent(html).run();
      setOpen(false);
      setPrompting(null);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  const item = "block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (setOpen((o) => !o), setError(null))}
        title="Rewrite with AI (applies to the selection, or the whole text)"
        className={`rounded px-2 py-0.5 text-xs ${open ? "bg-brand-600 text-white" : "text-brand-700 hover:bg-brand-50"}`}
      >
        {busy ? "✨ Working…" : "✨ AI"}
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
          {configured === false ? (
            <p className="px-3 py-2 text-xs text-amber-800">{AI_SETUP_HINT}</p>
          ) : prompting ? (
            <form
              className="p-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (instruction.trim()) run(prompting, instruction.trim());
              }}
            >
              <label className="mb-1 block text-xs font-medium text-slate-600">{prompting === "translate" ? "Translate to which language?" : "What should change?"}</label>
              <input
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={prompting === "translate" ? "e.g. German" : "e.g. Add a real-world example"}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
              />
              <div className="mt-2 flex justify-between">
                <button type="button" onClick={() => setPrompting(null)} className="text-xs text-slate-500 hover:text-slate-800">
                  Back
                </button>
                <button type="submit" disabled={busy || !instruction.trim()} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
                  {busy ? "Working…" : "Apply"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="px-3 pb-1 pt-1.5 text-[11px] uppercase tracking-wide text-slate-400">
                {editor.state.selection.empty ? "Whole text" : "Selected text"}
              </p>
              {actions.map(([action, label]) => (
                <button key={action} type="button" disabled={busy} onClick={() => run(action)} className={item}>
                  {label}
                </button>
              ))}
              <button type="button" disabled={busy} onClick={() => setPrompting("translate")} className={item}>
                Translate to…
              </button>
              <button type="button" disabled={busy} onClick={() => setPrompting("custom")} className={item}>
                Custom instruction…
              </button>
            </>
          )}
          {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
