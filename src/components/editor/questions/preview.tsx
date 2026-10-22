"use client";

import * as React from "react";
import type { QuestionDataOf } from "@lf/schema";
import { ArrowDown, ArrowUp, Check, CheckCircle2, CircleDashed, Eye, Pencil, RotateCcw, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionPage, QuestionType } from "./types";
import {
  gapIsCorrect,
  pointInArea,
  scoreChoice,
  scoreDragAndDrop,
  scoreFillInTheBlanks,
  scoreHotspot,
  scoreRanking,
  scoreStatements,
  scoreTextMatching,
  seededShuffle,
} from "./scoring";

// ---------------------------------------------------------------------------------------------
// Edit / Learner preview toggle used by every question type editor.
// ---------------------------------------------------------------------------------------------
export function EditPreviewSwitch({ mode, onModeChange }: { mode: "edit" | "preview"; onModeChange: (m: "edit" | "preview") => void }) {
  const items = [
    { key: "edit" as const, label: "Edit answers", icon: Pencil },
    { key: "preview" as const, label: "Learner preview", icon: Eye },
  ];
  return (
    <div role="radiogroup" aria-label="Answer area view" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={mode === key}
          onClick={() => onModeChange(key)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              onModeChange(mode === "edit" ? "preview" : "edit");
            }
          }}
          tabIndex={mode === key ? 0 : -1}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Shell: submit / try again / feedback (aria-live), same wording as the player.
// ---------------------------------------------------------------------------------------------
type Status = "idle" | "correct" | "incorrect" | "stored" | "empty";

interface PreviewApi {
  checked: boolean;
  /** reveal correct answers after a check */
  reveal: boolean;
}

function PreviewShell({
  page,
  instruction,
  evaluate,
  isEmpty,
  onReset,
  children,
  emptyAllowed,
}: {
  page: QuestionPage;
  instruction?: string;
  evaluate: () => boolean;
  isEmpty: boolean;
  onReset: () => void;
  emptyAllowed?: boolean;
  children: (api: PreviewApi) => React.ReactNode;
}) {
  const [status, setStatus] = React.useState<Status>("idle");
  const survey = page.scoringMode === 2;
  const nonScored = page.scoringMode === 1;
  const checked = status === "correct" || status === "incorrect" || status === "stored";

  const submit = () => {
    if (isEmpty && !emptyAllowed) return setStatus("empty");
    if (survey) return setStatus("stored");
    setStatus(evaluate() ? "correct" : "incorrect");
  };
  const reset = () => {
    setStatus("idle");
    onReset();
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-label="Learner preview" role="group">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">Preview</span>
        {(survey || nonScored) && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Not scored</span>}
      </div>
      {!page.hideTitle && <p className="text-base font-semibold text-card-foreground">{page.title || "Untitled question"}</p>}
      {instruction && <p className="mt-1 text-sm text-muted-foreground">{instruction}</p>}
      <div className="mt-4">{children({ checked, reveal: checked && !survey })}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {checked ? (
          <Button type="button" size="sm" variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw className="size-3.5" aria-hidden /> Try again
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={submit}>
            Submit
          </Button>
        )}
        <div aria-live="polite" className="text-sm">
          {status === "correct" && (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" aria-hidden /> That&apos;s correct!
            </span>
          )}
          {status === "incorrect" && (
            <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
              <XCircle className="size-4" aria-hidden /> That&apos;s incorrect.
            </span>
          )}
          {status === "stored" && (
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircle2 className="size-4" aria-hidden /> Your answer has been stored!
            </span>
          )}
          {status === "empty" && <span className="text-muted-foreground">Your answer is empty and was not stored.</span>}
        </div>
      </div>
      {nonScored && <p className="mt-2 text-xs text-muted-foreground">* This answer won’t affect your score or progress.</p>}
      {checked && (
        <p className="mt-3 text-xs text-muted-foreground">
          {page.isGeneralFeedback ? "Learners also see the response content you add in “Feedback” below." : "Learners also see the explanations you added to their chosen answers."}
        </p>
      )}
    </div>
  );
}

function resultTone(checked: boolean, ok: boolean | null) {
  if (!checked || ok === null) return "";
  return ok ? "border-emerald-600/70 bg-emerald-50 dark:bg-emerald-950/30" : "border-destructive/70 bg-destructive/5";
}

const optionBase =
  "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring";

// ---------------------------------------------------------------------------------------------
// Choice (text)
// ---------------------------------------------------------------------------------------------
function ChoicePreview({ page, data, multiple }: { page: QuestionPage; data: QuestionDataOf<"singleChoice">; multiple: boolean }) {
  const [sel, setSel] = React.useState<string[]>([]);
  const name = React.useId();
  return (
    <PreviewShell
      page={page}
      instruction={multiple ? "Select all answers that apply." : "Select one answer."}
      evaluate={() => scoreChoice(data.options, sel)}
      isEmpty={sel.length === 0}
      onReset={() => setSel([])}
    >
      {({ checked, reveal }) => (
        <div className="flex flex-col gap-2" role={multiple ? "group" : "radiogroup"} aria-label="Answer options">
          {data.options.map((o) => {
            const on = sel.includes(o.id);
            return (
              <label key={o.id} className={cn(optionBase, on && "border-primary", reveal && o.isCorrect && "border-emerald-600/70", checked && on && resultTone(true, o.isCorrect))}>
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={name}
                  checked={on}
                  disabled={checked}
                  onChange={() => setSel((s) => (multiple ? (on ? s.filter((x) => x !== o.id) : [...s, o.id]) : [o.id]))}
                  className="size-4 accent-[var(--color-primary,currentColor)]"
                />
                <span className="flex-1">{o.text || <em className="text-muted-foreground">Empty option</em>}</span>
                {reveal && o.isCorrect && <Check className="size-4 text-emerald-700 dark:text-emerald-400" aria-label="Correct answer" />}
              </label>
            );
          })}
        </div>
      )}
    </PreviewShell>
  );
}

function ImageChoicePreview({ page, data, multiple }: { page: QuestionPage; data: QuestionDataOf<"singleChoiceImage">; multiple: boolean }) {
  const [sel, setSel] = React.useState<string[]>([]);
  return (
    <PreviewShell
      page={page}
      instruction={multiple ? "Select all images that apply." : "Select one image."}
      evaluate={() => scoreChoice(data.options, sel)}
      isEmpty={sel.length === 0}
      onReset={() => setSel([])}
    >
      {({ checked, reveal }) => (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Image options">
          {data.options.map((o, i) => {
            const on = sel.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                disabled={checked}
                onClick={() => setSel((s) => (multiple ? (on ? s.filter((x) => x !== o.id) : [...s, o.id]) : [o.id]))}
                className={cn(
                  "relative overflow-hidden rounded-lg border-2 bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary" : "border-transparent",
                  reveal && o.isCorrect && "border-emerald-600",
                  checked && on && !o.isCorrect && "border-destructive",
                )}
              >
                {o.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.imageUrl} alt={o.alt || `Option ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <span className="flex aspect-[4/3] items-center justify-center text-xs text-muted-foreground">No image</span>
                )}
                {on && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </PreviewShell>
  );
}

function StatementPreview({ page, data }: { page: QuestionPage; data: QuestionDataOf<"statement"> }) {
  const [ans, setAns] = React.useState<Record<string, boolean | undefined>>({});
  return (
    <PreviewShell
      page={page}
      instruction="Mark each statement as either true or false."
      evaluate={() => scoreStatements(data.statements, ans)}
      isEmpty={data.statements.some((s) => ans[s.id] === undefined)}
      onReset={() => setAns({})}
    >
      {({ checked, reveal }) => (
        <ul className="flex flex-col gap-2">
          {data.statements.map((s) => (
            <li key={s.id} className={cn("flex flex-wrap items-center gap-3 rounded-lg border bg-background px-3 py-2", checked && resultTone(true, ans[s.id] === s.isTrue))}>
              <span className="min-w-0 flex-1 text-sm">{s.text || <em className="text-muted-foreground">Empty statement</em>}</span>
              <div className="flex gap-1" role="group" aria-label="True or false">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={ans[s.id] === v}
                    disabled={checked}
                    onClick={() => setAns((a) => ({ ...a, [s.id]: v }))}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      ans[s.id] === v ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                      reveal && s.isTrue === v && ans[s.id] !== v && "border-emerald-600 text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {v ? "True" : "False"}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PreviewShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Fill in the blanks: turn the author's HTML into React, replacing gap placeholders with inputs.
// ---------------------------------------------------------------------------------------------
const SAFE_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "code", "sub", "sup", "span", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "a", "mark"]);

function FibPreview({ page, data }: { page: QuestionPage; data: QuestionDataOf<"fillInTheBlanks"> }) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [doc, setDoc] = React.useState<Document | null>(null);
  React.useEffect(() => {
    setDoc(new DOMParser().parseFromString(`<body>${data.html}</body>`, "text/html"));
  }, [data.html]);
  const gaps = React.useMemo(() => new Map(data.gaps.map((g) => [g.id, g])), [data.gaps]);

  return (
    <PreviewShell
      page={page}
      instruction="Fill in the blanks."
      evaluate={() => scoreFillInTheBlanks(data, values)}
      isEmpty={data.gaps.every((g) => !values[g.id])}
      onReset={() => setValues({})}
    >
      {({ checked, reveal }) => {
        let n = 0;
        const render = (node: Node, key: string): React.ReactNode => {
          if (node.nodeType === 3) return node.textContent;
          if (node.nodeType !== 1) return null;
          const el = node as Element;
          const gapId = el.getAttribute("data-gap");
          if (gapId) {
            const gap = gaps.get(gapId);
            if (!gap) return null;
            n += 1;
            const ok = gapIsCorrect(gap, values[gap.id]);
            const tone = checked ? (ok ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-destructive bg-destructive/5") : "border-input";
            const correctText = gap.kind === "text" ? gap.answers[0] : gap.options.find((o) => o.isCorrect)?.text;
            return (
              <span key={key} className="mx-0.5 inline-flex items-baseline gap-1 align-baseline">
                {gap.kind === "text" ? (
                  <input
                    aria-label={`Blank ${n}`}
                    value={values[gap.id] ?? ""}
                    disabled={checked}
                    onChange={(e) => setValues((v) => ({ ...v, [gap.id]: e.target.value }))}
                    className={cn("h-7 w-32 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tone)}
                  />
                ) : (
                  <select
                    aria-label={`Dropdown ${n}`}
                    value={values[gap.id] ?? ""}
                    disabled={checked}
                    onChange={(e) => setValues((v) => ({ ...v, [gap.id]: e.target.value }))}
                    className={cn("h-7 rounded-md border bg-background px-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tone)}
                  >
                    <option value="">Choose…</option>
                    {gap.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.text}
                      </option>
                    ))}
                  </select>
                )}
                {reveal && !ok && correctText && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">({correctText})</span>}
              </span>
            );
          }
          const tag = el.tagName.toLowerCase();
          const children = Array.from(el.childNodes).map((c, i) => render(c, `${key}.${i}`));
          if (!SAFE_TAGS.has(tag)) return <React.Fragment key={key}>{children}</React.Fragment>;
          if (tag === "br") return <br key={key} />;
          const Tag = tag as keyof React.JSX.IntrinsicElements;
          return React.createElement(Tag, { key, className: tag === "p" ? "leading-9" : undefined }, children);
        };
        if (!doc) return null;
        if (!data.html.trim()) return <p className="text-sm text-muted-foreground">Write the text with blanks to see it here.</p>;
        return <div className="prose prose-sm max-w-none text-sm dark:prose-invert">{Array.from(doc.body.childNodes).map((c, i) => render(c, String(i)))}</div>;
      }}
    </PreviewShell>
  );
}

function TextMatchingPreview({ page, data }: { page: QuestionPage; data: QuestionDataOf<"textMatching"> }) {
  const [chosen, setChosen] = React.useState<Record<string, string>>({});
  const [seed, setSeed] = React.useState(7);
  const shuffled = React.useMemo(() => seededShuffle(data.pairs, seed), [data.pairs, seed]);
  return (
    <PreviewShell
      page={page}
      instruction="Match each item on the left with the right answer."
      evaluate={() => scoreTextMatching(data.pairs, chosen)}
      isEmpty={Object.keys(chosen).length === 0}
      onReset={() => {
        setChosen({});
        setSeed((s) => s + 1);
      }}
    >
      {({ checked, reveal }) => (
        <ul className="flex flex-col gap-2">
          {data.pairs.map((p, i) => {
            const pick = data.pairs.find((q) => q.id === chosen[p.id]);
            const ok = !!pick && pick.match.trim() === p.match.trim();
            return (
              <li key={p.id} className={cn("grid grid-cols-1 items-center gap-2 rounded-lg border bg-background p-2 sm:grid-cols-2", checked && resultTone(true, ok))}>
                <span className="px-1 text-sm font-medium">{p.term || <em className="text-muted-foreground">Empty term</em>}</span>
                <div className="flex flex-col gap-1">
                  <select
                    aria-label={`Match for item ${i + 1}`}
                    value={chosen[p.id] ?? ""}
                    disabled={checked}
                    onChange={(e) => setChosen((c) => ({ ...c, [p.id]: e.target.value }))}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Choose a match…</option>
                    {shuffled.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.match || "(empty)"}
                      </option>
                    ))}
                  </select>
                  {reveal && !ok && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Correct: {p.match}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PreviewShell>
  );
}

function DragAndDropPreview({ page, data }: { page: QuestionPage; data: QuestionDataOf<"dragAndDropText"> }) {
  const [placed, setPlaced] = React.useState<Record<string, string | undefined>>({});
  const [picked, setPicked] = React.useState<string | null>(null);
  const [seed, setSeed] = React.useState(3);
  const usedSources = new Set(Object.values(placed).filter(Boolean) as string[]);
  const pool = React.useMemo(() => seededShuffle(data.spots, seed), [data.spots, seed]).filter((s) => !usedSources.has(s.id));
  const textOf = (id?: string) => data.spots.find((s) => s.id === id)?.text ?? "";

  return (
    <PreviewShell
      page={page}
      instruction="Pick a text, then choose the spot where it belongs."
      evaluate={() => scoreDragAndDrop(data.spots, placed)}
      isEmpty={usedSources.size === 0}
      onReset={() => {
        setPlaced({});
        setPicked(null);
        setSeed((s) => s + 1);
      }}
    >
      {({ checked, reveal }) =>
        !data.backgroundUrl ? (
          <p className="text-sm text-muted-foreground">Add a background image to preview this question.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex min-h-10 flex-wrap gap-2 rounded-lg border border-dashed p-2" aria-label="Texts to place" role="group">
              {pool.length === 0 ? (
                <span className="text-xs text-muted-foreground">All texts have been placed.</span>
              ) : (
                pool.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={picked === s.id}
                    disabled={checked}
                    onClick={() => setPicked((p) => (p === s.id ? null : s.id))}
                    className={cn("rounded-md border bg-background px-2.5 py-1 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", picked === s.id && "border-primary ring-2 ring-primary/30")}
                  >
                    {s.text || "(empty)"}
                  </button>
                ))
              )}
            </div>
            <div className="relative overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.backgroundUrl} alt="" className="block w-full select-none" draggable={false} />
              {data.spots.map((s, i) => {
                const val = placed[s.id];
                const ok = !!val && textOf(val).trim() === s.text.trim();
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={checked}
                    aria-label={val ? `Spot ${i + 1}: ${textOf(val)}. Activate to remove.` : `Spot ${i + 1}: empty${picked ? ". Activate to place the selected text." : ""}`}
                    onClick={() => {
                      if (val) setPlaced((p) => ({ ...p, [s.id]: undefined }));
                      else if (picked) {
                        setPlaced((p) => ({ ...p, [s.id]: picked }));
                        setPicked(null);
                      }
                    }}
                    style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    className={cn(
                      "absolute min-h-7 min-w-20 rounded-md border-2 border-dashed px-2 py-1 text-xs font-medium shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      val ? "border-solid border-primary bg-background" : "border-white/90 bg-black/40 text-white",
                      checked && (ok ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-destructive bg-red-50 text-red-900"),
                    )}
                  >
                    {val ? textOf(val) : reveal ? s.text : "Drop here"}
                  </button>
                );
              })}
            </div>
          </div>
        )
      }
    </PreviewShell>
  );
}

function HotspotPreview({ page, data }: { page: QuestionPage; data: QuestionDataOf<"hotspot"> }) {
  const [markers, setMarkers] = React.useState<{ x: number; y: number }[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <PreviewShell
      page={page}
      instruction={data.mode === "single" ? "Click the correct spot on the image." : "Click all correct spots on the image."}
      evaluate={() => scoreHotspot(data, markers)}
      isEmpty={markers.length === 0}
      onReset={() => setMarkers([])}
    >
      {({ checked, reveal }) =>
        !data.backgroundUrl ? (
          <p className="text-sm text-muted-foreground">Add a background image to preview this question.</p>
        ) : (
          <div
            ref={ref}
            className={cn("relative overflow-hidden rounded-lg border", !checked && "cursor-crosshair")}
            onClick={(e) => {
              if (checked || !ref.current) return;
              const r = ref.current.getBoundingClientRect();
              const p = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
              setMarkers((m) => (data.mode === "single" ? [p] : [...m, p]));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.backgroundUrl} alt="Hotspot image" className="block w-full select-none" draggable={false} />
            {reveal &&
              data.areas.map((a) => (
                <div key={a.id} className="pointer-events-none absolute rounded border-2 border-emerald-500 bg-emerald-400/20" style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%` }} />
              ))}
            {markers.map((m, i) => {
              const inside = data.areas.some((a) => pointInArea(m, a));
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Marker ${i + 1}. Activate to remove.`}
                  disabled={checked}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMarkers((ms) => ms.filter((_, j) => j !== i));
                  }}
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  className={cn(
                    "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    checked ? (inside ? "bg-emerald-600" : "bg-destructive") : "bg-primary",
                  )}
                >
                  {checked ? inside ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}
                </button>
              );
            })}
          </div>
        )
      }
    </PreviewShell>
  );
}

function OpenQuestionPreview({ page, data }: { page: QuestionPage; data: QuestionDataOf<"openQuestion"> }) {
  const [text, setText] = React.useState("");
  return (
    <PreviewShell page={page} evaluate={() => text.trim().length > 0} isEmpty={!text.trim()} emptyAllowed={page.scoringMode !== 2} onReset={() => setText("")}>
      {({ checked }) => (
        <div>
          <textarea
            aria-label="Your answer"
            value={text}
            maxLength={data.maxLength}
            disabled={checked}
            placeholder={data.placeholder}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {text.length} / {data.maxLength}
          </p>
        </div>
      )}
    </PreviewShell>
  );
}

function RankingPreview({ page, data }: { page: QuestionPage; data: QuestionDataOf<"ranking"> }) {
  const [seed, setSeed] = React.useState(11);
  const initial = React.useMemo(() => {
    const ids = data.items.map((i) => i.id);
    let s = seededShuffle(ids, seed);
    if (ids.length > 1 && s.every((id, i) => id === ids[i])) s = [...s.slice(1), s[0]];
    return s;
  }, [data.items, seed]);
  const [order, setOrder] = React.useState(initial);
  React.useEffect(() => setOrder(initial), [initial]);
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = o.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <PreviewShell page={page} instruction="Put the items in the right order." evaluate={() => scoreRanking(data.items, order)} isEmpty={false} onReset={() => setSeed((s) => s + 1)}>
      {({ checked }) => (
        <ol className="flex flex-col gap-2">
          {order.map((id, i) => {
            const item = data.items.find((x) => x.id === id);
            if (!item) return null;
            const ok = data.items[i]?.id === id;
            return (
              <li key={id} className={cn("flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm", checked && resultTone(true, ok))}>
                <span className="w-5 text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                <span className="flex-1">{item.text || <em className="text-muted-foreground">Empty item</em>}</span>
                <button type="button" aria-label={`Move “${item.text}” up`} disabled={checked || i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button type="button" aria-label={`Move “${item.text}” down`} disabled={checked || i === order.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ArrowDown className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </PreviewShell>
  );
}

/** Learner preview for any question type. Keyed by data so it resets when the author edits. */
export function LearnerPreview({ type, page, data }: { type: QuestionType; page: QuestionPage; data: unknown }) {
  switch (type) {
    case "singleChoice":
      return <ChoicePreview page={page} data={data as QuestionDataOf<"singleChoice">} multiple={false} />;
    case "multipleChoice":
      return <ChoicePreview page={page} data={data as QuestionDataOf<"multipleChoice">} multiple />;
    case "singleChoiceImage":
      return <ImageChoicePreview page={page} data={data as QuestionDataOf<"singleChoiceImage">} multiple={false} />;
    case "multipleChoiceImage":
      return <ImageChoicePreview page={page} data={data as QuestionDataOf<"multipleChoiceImage">} multiple />;
    case "statement":
      return <StatementPreview page={page} data={data as QuestionDataOf<"statement">} />;
    case "fillInTheBlanks":
      return <FibPreview page={page} data={data as QuestionDataOf<"fillInTheBlanks">} />;
    case "textMatching":
      return <TextMatchingPreview page={page} data={data as QuestionDataOf<"textMatching">} />;
    case "dragAndDropText":
      return <DragAndDropPreview page={page} data={data as QuestionDataOf<"dragAndDropText">} />;
    case "hotspot":
      return <HotspotPreview page={page} data={data as QuestionDataOf<"hotspot">} />;
    case "openQuestion":
      return <OpenQuestionPreview page={page} data={data as QuestionDataOf<"openQuestion">} />;
    case "ranking":
      return <RankingPreview page={page} data={data as QuestionDataOf<"ranking">} />;
  }
}
