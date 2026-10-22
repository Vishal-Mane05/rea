"use client";

import { useState } from "react";
import { del, patch, post, useDebouncedSave } from "@/lib/client";
import type { Update } from "./Editor";
import { AutoText, IconButton, Toggle } from "./fields";
import { MediaPickerButton } from "./MediaLibrary";
import { RichText } from "./RichText";
import { pageTypeLabels, type Answer, type Block, type BlockType, type Course, type Page, type Section } from "./types";

function findPage(d: Course, id: string) {
  for (const s of d.sections) {
    const p = s.pages.find((x) => x.id === id);
    if (p) return p;
  }
  throw new Error(`page ${id} not in course`);
}

const blockKinds: { type: BlockType; label: string; icon: string }[] = [
  { type: "TEXT", label: "Text", icon: "¶" },
  { type: "CALLOUT", label: "Callout", icon: "💡" },
  { type: "IMAGE", label: "Image", icon: "🖼" },
  { type: "VIDEO", label: "Video", icon: "▶" },
  { type: "COLUMNS", label: "Two columns", icon: "▥" },
];

export function PageEditor({ page, section, update }: { page: Page; section: Section; update: Update }) {
  const url = `/api/pages/${page.id}`;
  const isQuestion = page.type !== "CONTENT";
  const edit = (fn: (p: Page) => void) => update((d) => fn(findPage(d, page.id)));

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        {section.title || "Untitled section"} · {pageTypeLabels[page.type]}
      </p>
      <AutoText
        url={url}
        field="title"
        value={page.title}
        onLocal={(v) => edit((p) => void (p.title = v))}
        placeholder={isQuestion ? "Type your question" : "Page title"}
        className="text-3xl font-semibold"
        multiline={isQuestion}
      />
      {isQuestion ? <QuestionEditor page={page} edit={edit} /> : <BlockList page={page} edit={edit} />}
    </div>
  );
}

type Edit = (fn: (p: Page) => void) => void;

function BlockList({ page, edit }: { page: Page; edit: Edit }) {
  async function add(type: BlockType, position: number) {
    const block = await post<Block>(`/api/pages/${page.id}/blocks`, { type, position });
    edit((p) => {
      p.blocks.splice(position, 0, block);
      p.blocks.forEach((b, i) => (b.position = i));
    });
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= page.blocks.length) return;
    const ids = page.blocks.map((b) => b.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    edit((p) => {
      [p.blocks[index], p.blocks[j]] = [p.blocks[j], p.blocks[index]];
      p.blocks.forEach((b, i) => (b.position = i));
    });
    post("/api/reorder", { kind: "block", parentId: page.id, ids });
  }

  async function remove(block: Block) {
    edit((p) => void (p.blocks = p.blocks.filter((b) => b.id !== block.id)));
    await del(`/api/blocks/${block.id}`);
  }

  return (
    <div>
      <InsertMenu onPick={(t) => add(t, 0)} />
      {page.blocks.map((block, i) => (
        <div key={block.id}>
          <div className="group relative rounded-xl border border-transparent bg-white p-4 shadow-sm hover:border-slate-200">
            <div className="absolute -right-2 -top-3 hidden gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm group-hover:flex">
              <IconButton title="Move block up" onClick={() => move(i, -1)}>↑</IconButton>
              <IconButton title="Move block down" onClick={() => move(i, 1)}>↓</IconButton>
              <IconButton title="Delete block" danger onClick={() => remove(block)}>✕</IconButton>
            </div>
            <BlockView block={block} edit={edit} />
          </div>
          <InsertMenu onPick={(t) => add(t, i + 1)} />
        </div>
      ))}
    </div>
  );
}

function InsertMenu({ onPick }: { onPick: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group/ins relative flex h-6 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-brand-200 opacity-0 group-hover/ins:opacity-100" />
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative z-10 grid size-5 place-items-center rounded-full bg-brand-600 text-xs text-white opacity-0 group-hover/ins:opacity-100 focus:opacity-100"
        title="Insert block"
      >
        +
      </button>
      {open && (
        <div className="absolute top-6 z-30 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {blockKinds.map((k) => (
            <button
              key={k.type}
              onClick={() => {
                setOpen(false);
                onPick(k.type);
              }}
              className="flex flex-col items-center rounded-lg px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              <span className="text-base">{k.icon}</span>
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockView({ block, edit }: { block: Block; edit: Edit }) {
  const url = `/api/blocks/${block.id}`;
  const saveHtml = useDebouncedSave(url, "html");
  const [urlVersion, setUrlVersion] = useState(0);
  const setField = (field: "html" | "url" | "caption", value: string | null) =>
    edit((p) => {
      const b = p.blocks.find((x) => x.id === block.id) ?? p.blocks.flatMap((x) => x.children ?? []).find((x) => x.id === block.id);
      if (b) (b[field] as string | null) = value;
    });

  switch (block.type) {
    case "TEXT":
      return <RichText html={block.html} onChange={(h) => (setField("html", h), saveHtml(h))} placeholder="Write something…" />;
    case "CALLOUT":
      return (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3">
          <RichText html={block.html} onChange={(h) => (setField("html", h), saveHtml(h))} placeholder="Highlight a key point…" />
        </div>
      );
    case "IMAGE":
    case "VIDEO":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {block.type === "IMAGE" ? "🖼 Image — upload or paste a URL" : "▶ Video — upload, or paste a YouTube, Vimeo or .mp4 URL"}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              {/* re-keyed when a library pick replaces the value, since AutoText owns its input state */}
              <AutoText key={urlVersion} url={url} field="url" value={isMediaPath(block.url) ? "" : block.url ?? ""} onLocal={(v) => setField("url", v || null)} placeholder={isMediaPath(block.url) ? "Uploaded file — paste a URL to replace" : "https://…"} emptyAsNull className="rounded border border-slate-200 px-2 py-1 text-sm" />
            </div>
            <MediaPickerButton
              kind={block.type === "IMAGE" ? "image" : "video"}
              onPick={(picked) => {
                setField("url", picked);
                setUrlVersion((n) => n + 1);
                patch(url, { url: picked }).catch(() => {});
              }}
            />
          </div>
          {block.url && <MediaPreview type={block.type} src={block.url} />}
          <AutoText url={url} field="caption" value={block.caption} onLocal={(v) => setField("caption", v)} placeholder="Caption (optional)" className="text-sm text-slate-500" />
        </div>
      );
    case "COLUMNS":
      return (
        <div className="grid grid-cols-2 gap-4">
          {(block.children ?? []).map((child) => (
            <div key={child.id} className="rounded-lg border border-dashed border-slate-200 p-3">
              <ColumnText block={child} setHtml={(h) => edit((p) => {
                const parent = p.blocks.find((x) => x.id === block.id);
                const c = parent?.children?.find((x) => x.id === child.id);
                if (c) c.html = h;
              })} />
            </div>
          ))}
        </div>
      );
  }
}

const isMediaPath = (u: string | null) => !!u && u.startsWith("/api/media/");

function ColumnText({ block, setHtml }: { block: Block; setHtml: (h: string) => void }) {
  const save = useDebouncedSave(`/api/blocks/${block.id}`, "html");
  return <RichText html={block.html} onChange={(h) => (setHtml(h), save(h))} placeholder="Column text…" />;
}

function embedUrl(src: string) {
  const yt = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = src.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function MediaPreview({ type, src }: { type: "IMAGE" | "VIDEO"; src: string }) {
  if (type === "IMAGE")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="max-h-80 rounded-lg" />;
  const embed = embedUrl(src);
  return embed ? (
    <iframe src={embed} className="aspect-video w-full rounded-lg" allowFullScreen title="Video preview" />
  ) : (
    <video src={src} controls className="w-full rounded-lg" />
  );
}

function QuestionEditor({ page, edit }: { page: Page; edit: Edit }) {
  const url = `/api/pages/${page.id}`;
  const fixed = page.type === "TRUE_FALSE";
  const exclusive = page.type === "SINGLE_CHOICE" || page.type === "TRUE_FALSE";

  async function addAnswer() {
    const a = await post<Answer>(`/api/pages/${page.id}/answers`, {});
    edit((p) => void p.answers.push(a));
  }

  async function removeAnswer(a: Answer) {
    edit((p) => void (p.answers = p.answers.filter((x) => x.id !== a.id)));
    await del(`/api/answers/${a.id}`);
  }

  function setCorrect(a: Answer, value: boolean) {
    edit((p) => {
      for (const x of p.answers) {
        if (x.id === a.id) x.isCorrect = value;
        else if (exclusive && value) x.isCorrect = false;
      }
    });
    patch(`/api/answers/${a.id}`, { isCorrect: value }).catch(() => {});
  }

  function setFlag(field: "isScored" | "isSurvey", value: boolean) {
    edit((p) => void (p[field] = value));
    patch(url, { [field]: value }).catch(() => {});
  }

  return (
    <div className="space-y-6">
      {page.type === "OPEN_QUESTION" ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          Learners type a free-text answer. Open questions are not scored automatically.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">
            Answers — mark the {exclusive ? "correct one" : "correct ones"}
          </p>
          {page.answers.map((a) => (
            <div key={a.id} className={`rounded-xl border bg-white p-3 ${a.isCorrect ? "border-emerald-400" : "border-slate-200"}`}>
              <div className="flex items-center gap-3">
                <input
                  type={exclusive ? "radio" : "checkbox"}
                  name={`correct-${page.id}`}
                  checked={a.isCorrect}
                  onChange={(e) => setCorrect(a, exclusive ? true : e.target.checked)}
                  className="size-4 accent-emerald-600"
                  title="Correct answer"
                />
                <div className="flex-1">
                  <AutoText
                    url={`/api/answers/${a.id}`}
                    field="text"
                    value={a.text}
                    onLocal={(v) => edit((p) => void (p.answers.find((x) => x.id === a.id)!.text = v))}
                    placeholder="Answer text"
                  />
                </div>
                {!fixed && (
                  <IconButton title="Delete answer" danger onClick={() => removeAnswer(a)}>
                    ✕
                  </IconButton>
                )}
              </div>
              <div className="mt-1 pl-7">
                <AutoText
                  url={`/api/answers/${a.id}`}
                  field="explanation"
                  value={a.explanation}
                  onLocal={(v) => edit((p) => void (p.answers.find((x) => x.id === a.id)!.explanation = v))}
                  placeholder="Explanation shown after answering (optional)"
                  className="text-xs text-slate-500"
                />
              </div>
            </div>
          ))}
          {!fixed && (
            <button onClick={addAnswer} className="text-sm text-brand-600 hover:underline">
              + Add answer
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="mb-1 text-xs font-medium text-emerald-700">Feedback when correct</p>
          <AutoText url={url} field="correctFeedback" value={page.correctFeedback} onLocal={(v) => edit((p) => void (p.correctFeedback = v))} placeholder="Well done!" multiline className="text-sm" />
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="mb-1 text-xs font-medium text-rose-700">Feedback when incorrect</p>
          <AutoText url={url} field="incorrectFeedback" value={page.incorrectFeedback} onLocal={(v) => edit((p) => void (p.incorrectFeedback = v))} placeholder="Not quite — review the section and try again." multiline className="text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white p-4">
        <Toggle checked={page.isScored} onChange={(v) => setFlag("isScored", v)} label="Counts towards score" />
        <Toggle checked={page.isSurvey} onChange={(v) => setFlag("isSurvey", v)} label="Survey (no right answer)" />
      </div>
    </div>
  );
}
