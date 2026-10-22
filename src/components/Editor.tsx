"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, del, patch, post, useSaveStatus } from "@/lib/client";
import { defaultSettings } from "../../../player/src/format";
import { GenerateQuiz } from "./ai/GenerateQuiz";
import { AutoText, IconButton, Toggle } from "./fields";
import { MediaPickerButton } from "./MediaLibrary";
import { PageEditor } from "./PageEditor";
import { pageTypeIcons, pageTypeLabels, type Course, type CourseSettings, type Page, type PageType, type Section } from "./types";

export type Selection = { kind: "section" | "page"; id: string } | null;
export type Update = (fn: (draft: Course) => void) => void;

const pageTypes = Object.keys(pageTypeLabels) as PageType[];

/** Swap item `index` with its neighbour in `dir` and persist the order. */
function moveItem<T extends { id: string; position: number }>(list: T[], index: number, dir: -1 | 1) {
  const j = index + dir;
  if (j < 0 || j >= list.length) return null;
  [list[index], list[j]] = [list[j], list[index]];
  list.forEach((x, i) => (x.position = i));
  return list.map((x) => x.id);
}

export function Editor({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [missing, setMissing] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    api<Course>(`/api/courses/${courseId}`)
      .then((c) => {
        setCourse(c);
        const first = c.sections[0]?.pages[0];
        setSelection(first ? { kind: "page", id: first.id } : c.sections[0] ? { kind: "section", id: c.sections[0].id } : null);
      })
      .catch(() => setMissing(true));
  }, [courseId]);

  const update: Update = useCallback((fn) => {
    setCourse((c) => {
      if (!c) return c;
      const draft = structuredClone(c);
      fn(draft);
      return draft;
    });
  }, []);

  if (missing)
    return (
      <div className="grid min-h-screen place-items-center text-center">
        <div>
          <p className="text-lg font-medium">Course not found</p>
          <Link href="/" className="mt-2 inline-block text-brand-600 hover:underline">
            Back to my courses
          </Link>
        </div>
      </div>
    );
  if (!course) return <div className="grid min-h-screen place-items-center text-slate-500">Loading course…</div>;

  const selectedSection =
    selection?.kind === "section" ? course.sections.find((s) => s.id === selection.id) : undefined;
  let selectedPage: Page | undefined;
  let pageSection: Section | undefined;
  if (selection?.kind === "page") {
    for (const s of course.sections) {
      const p = s.pages.find((x) => x.id === selection.id);
      if (p) {
        selectedPage = p;
        pageSection = s;
      }
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar course={course} update={update} onSettings={() => setShowSettings(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar course={course} update={update} selection={selection} select={setSelection} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto max-w-3xl px-8 py-10">
            {selectedPage && pageSection ? (
              <PageEditor key={selectedPage.id} page={selectedPage} section={pageSection} update={update} />
            ) : selectedSection ? (
              <SectionPane key={selectedSection.id} section={selectedSection} update={update} />
            ) : (
              <p className="text-slate-500">Select a section or page on the left, or add a new section.</p>
            )}
          </div>
        </main>
      </div>
      {showSettings && <SettingsDrawer course={course} update={update} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function SaveIndicator() {
  const status = useSaveStatus();
  const text = { idle: "", saving: "Saving…", saved: "All changes saved", error: "Couldn't save — retrying on next edit" }[status];
  return <span className={`text-xs ${status === "error" ? "text-red-600" : "text-slate-500"}`}>{text}</span>;
}

function TopBar({ course, update, onSettings }: { course: Course; update: Update; onSettings: () => void }) {
  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2.5">
      <Link href="/" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 font-semibold text-white" title="My courses">
        L
      </Link>
      <div className="min-w-0 flex-1">
        <AutoText
          url={`/api/courses/${course.id}`}
          field="title"
          value={course.title}
          onLocal={(v) => update((d) => void (d.title = v))}
          placeholder="Course title"
          className="truncate text-base font-semibold"
        />
      </div>
      <SaveIndicator />
      <button onClick={onSettings} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
        Settings
      </button>
      <a
        href={`/preview/${course.id}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        Preview
      </a>
      <ExportMenu courseId={course.id} />
    </header>
  );
}

const exportFormats = [
  { format: "scorm12", label: "SCORM 1.2", hint: "Most LMSs" },
  { format: "scorm2004", label: "SCORM 2004", hint: "4th edition" },
  { format: "xapi", label: "xAPI (Tin Can)", hint: "For an LRS" },
  { format: "html", label: "HTML website", hint: "Host anywhere" },
];

function ExportMenu({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
        Export ▾
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {exportFormats.map((f) => (
            <a
              key={f.format}
              href={`/api/courses/${courseId}/export?format=${f.format}`}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-xs text-slate-500">{f.hint} · .zip</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ course, update, selection, select }: { course: Course; update: Update; selection: Selection; select: (s: Selection) => void }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  async function addSection() {
    const s = await post<Section>(`/api/courses/${course.id}/sections`);
    update((d) => void d.sections.push(s));
    select({ kind: "page", id: s.pages[0]?.id ?? s.id });
  }

  async function addPage(section: Section, type: PageType) {
    setMenuFor(null);
    const p = await post<Page>(`/api/sections/${section.id}/pages`, { type });
    update((d) => void d.sections.find((s) => s.id === section.id)?.pages.push(p));
    select({ kind: "page", id: p.id });
  }

  function moveSection(index: number, dir: -1 | 1) {
    const order = moveItem(course.sections.map((s) => ({ ...s })), index, dir);
    if (!order) return;
    update((d) => void moveItem(d.sections, index, dir));
    post("/api/reorder", { kind: "section", parentId: course.id, ids: order });
  }

  function movePage(section: Section, index: number, dir: -1 | 1) {
    const order = moveItem(section.pages.map((p) => ({ ...p })), index, dir);
    if (!order) return;
    update((d) => void moveItem(d.sections.find((s) => s.id === section.id)!.pages, index, dir));
    post("/api/reorder", { kind: "page", parentId: section.id, ids: order });
  }

  async function removeSection(section: Section) {
    if (!confirm(`Delete section "${section.title}" and all its pages?`)) return;
    update((d) => void (d.sections = d.sections.filter((s) => s.id !== section.id)));
    if (selection && (selection.id === section.id || section.pages.some((p) => p.id === selection.id))) select(null);
    await del(`/api/sections/${section.id}`);
  }

  async function removePage(section: Section, page: Page) {
    if (!confirm(`Delete "${page.title}"?`)) return;
    update((d) => {
      const s = d.sections.find((x) => x.id === section.id)!;
      s.pages = s.pages.filter((p) => p.id !== page.id);
    });
    if (selection?.id === page.id) select({ kind: "section", id: section.id });
    await del(`/api/pages/${page.id}`);
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex-1 overflow-y-auto p-3">
        {course.sections.map((section, si) => (
          <div key={section.id} className="mb-3">
            <div
              onClick={() => select({ kind: "section", id: section.id })}
              className={`group flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 ${
                selection?.id === section.id ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50"
              }`}
            >
              <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                {si + 1}. {section.title || "Untitled section"}
              </span>
              <span className="hidden gap-0.5 group-hover:flex">
                <IconButton title="Generate quiz with AI" onClick={() => select({ kind: "section", id: section.id })}>✨</IconButton>
                <IconButton title="Move section up" onClick={() => moveSection(si, -1)}>↑</IconButton>
                <IconButton title="Move section down" onClick={() => moveSection(si, 1)}>↓</IconButton>
                <IconButton title="Delete section" danger onClick={() => removeSection(section)}>✕</IconButton>
              </span>
            </div>
            <ul className="mt-0.5">
              {section.pages.map((page, pi) => (
                <li
                  key={page.id}
                  onClick={() => select({ kind: "page", id: page.id })}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-4 pr-2 text-sm ${
                    selection?.id === page.id ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="w-4 text-center text-xs opacity-70" title={pageTypeLabels[page.type]}>
                    {pageTypeIcons[page.type]}
                  </span>
                  <span className="flex-1 truncate">{page.title || "Untitled"}</span>
                  <span className="hidden gap-0.5 group-hover:flex">
                    <IconButton title="Move up" onClick={() => movePage(section, pi, -1)}>↑</IconButton>
                    <IconButton title="Move down" onClick={() => movePage(section, pi, 1)}>↓</IconButton>
                    <IconButton title="Delete" danger onClick={() => removePage(section, page)}>✕</IconButton>
                  </span>
                </li>
              ))}
            </ul>
            <div className="relative pl-4">
              <button
                onClick={() => setMenuFor(menuFor === section.id ? null : section.id)}
                className="mt-1 text-xs text-brand-600 hover:underline"
              >
                + Add page or question
              </button>
              {menuFor === section.id && (
                <div className="absolute z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {pageTypes.map((t) => (
                    <button key={t} onClick={() => addPage(section, t)} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-50">
                      <span className="w-4 text-center">{pageTypeIcons[t]}</span>
                      {pageTypeLabels[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 p-3">
        <button onClick={addSection} className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-600 hover:border-brand-500 hover:text-brand-600">
          + Add section
        </button>
      </div>
    </aside>
  );
}

function SectionPane({ section, update }: { section: Section; update: Update }) {
  const url = `/api/sections/${section.id}`;
  // remount the URL field only when a library pick replaces its value, not while typing
  const [picks, setPicks] = useState(0);
  const set = (field: "title" | "learningObjective" | "imageUrl") => (v: string) =>
    update((d) => {
      const s = d.sections.find((x) => x.id === section.id);
      if (s) (s[field] as string | null) = v;
    });
  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Section</p>
      <AutoText url={url} field="title" value={section.title} onLocal={set("title")} placeholder="Section title" className="text-3xl font-semibold" />
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-1 text-xs font-medium text-slate-500">Learning objective</p>
        <AutoText url={url} field="learningObjective" value={section.learningObjective} onLocal={set("learningObjective")} placeholder="What will learners be able to do after this section?" multiline />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-1 text-xs font-medium text-slate-500">Cover image URL</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <AutoText key={`${section.id}-${picks}`} url={url} field="imageUrl" value={section.imageUrl?.startsWith("/api/media/") ? "" : section.imageUrl ?? ""} onLocal={set("imageUrl")} placeholder={section.imageUrl?.startsWith("/api/media/") ? "Uploaded image — paste a URL to replace" : "https://…"} emptyAsNull />
          </div>
          <MediaPickerButton kind="image" onPick={(picked) => (set("imageUrl")(picked), setPicks((n) => n + 1), patch(url, { imageUrl: picked }).catch(() => {}))} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {section.imageUrl && <img src={section.imageUrl} alt="" className="mt-3 max-h-48 rounded-lg object-cover" />}
      </div>
      <p className="text-sm text-slate-500">
        {section.pages.length} page{section.pages.length === 1 ? "" : "s"} in this section.
      </p>
      <GenerateQuiz
        sectionId={section.id}
        onCreated={(pages) => update((d) => void d.sections.find((s) => s.id === section.id)?.pages.push(...pages))}
      />
    </div>
  );
}

function SettingsDrawer({ course, update, onClose }: { course: Course; update: Update; onClose: () => void }) {
  const settings: CourseSettings = { ...defaultSettings, ...course.settings };
  const set = <K extends keyof CourseSettings>(key: K, value: CourseSettings[K]) => {
    update((d) => void (d.settings = { ...settings, [key]: value }));
    patch(`/api/courses/${course.id}`, { settings: { [key]: value } }).catch(() => {});
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-96 overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Course settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">✕</button>
        </div>

        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Layout</legend>
            {(
              [
                ["pageByPage", "One page at a time", "Learners click Next to continue"],
                ["onePage", "Whole section on one page", "Learners scroll through a section"],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="mb-2 flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="layout" checked={settings.layout === value} onChange={() => set("layout", value)} />
                <span>
                  <span className="block text-sm">{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div>
            <label className="mb-2 block text-sm font-medium">Passing score: {settings.passingScore}%</label>
            <input type="range" min={0} max={100} step={5} value={settings.passingScore} onChange={(e) => set("passingScore", Number(e.target.value))} className="w-full accent-brand-600" />
          </div>

          <div className="space-y-3">
            <Toggle checked={settings.showFeedback} onChange={(v) => set("showFeedback", v)} label="Show feedback after each question" />
            <Toggle checked={settings.allowRetry} onChange={(v) => set("allowRetry", v)} label="Allow learners to retry" />
            <Toggle checked={settings.showProgress} onChange={(v) => set("showProgress", v)} label="Show progress bar" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Accent colour</label>
            <input type="color" value={settings.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-10 w-20 cursor-pointer rounded border border-slate-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
