"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, del, post } from "@/lib/client";
import { GenerateCourseDialog } from "./ai/GenerateCourseDialog";
import type { CourseSummary, TemplateSummary } from "./types";

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function Dashboard() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    api<CourseSummary[]>("/api/courses").then(setCourses).catch(() => setCourses([]));
  }, []);

  const visible = useMemo(
    () => (courses ?? []).filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase())),
    [courses, query],
  );

  async function remove(c: CourseSummary) {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    setCourses((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
    await del(`/api/courses/${c.id}`);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">L</span>
            LearnForge
          </div>
          <button
            onClick={() => setShowGallery(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + New course
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My courses</h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses…"
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>

        {courses === null ? (
          <p className="text-slate-500">Loading…</p>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-4xl">🎓</p>
            <h2 className="mt-3 text-lg font-semibold">Create your first course</h2>
            <p className="mt-1 text-slate-500">Start from a template or a blank canvas.</p>
            <button
              onClick={() => setShowGallery(true)}
              className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Choose a template
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <div key={c.id} className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md">
                <Link href={`/courses/${c.id}`} className="absolute inset-0" aria-label={`Open ${c.title}`} />
                <div className="mb-8 h-24 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50" />
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{c.title}</h3>
                  {c.publishedAt && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Published</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {c._count.sections} section{c._count.sections === 1 ? "" : "s"} · edited {timeAgo(c.updatedAt)}
                </p>
                <button
                  onClick={() => remove(c)}
                  className="relative z-10 mt-3 text-xs text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}
            {visible.length === 0 && <p className="text-slate-500">No courses match “{query}”.</p>}
          </div>
        )}
      </main>

      {showGallery && <TemplateGallery onClose={() => setShowGallery(false)} />}
    </div>
  );
}

function TemplateGallery({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [withAi, setWithAi] = useState(false);

  useEffect(() => {
    api<TemplateSummary[]>("/api/templates").then(setTemplates);
  }, []);

  if (withAi) return <GenerateCourseDialog onBack={() => setWithAi(false)} onClose={onClose} />;

  async function create(key: string) {
    setCreating(key);
    try {
      const { id } = await post<{ id: string }>("/api/courses", { templateKey: key });
      router.push(`/courses/${id}`);
    } catch {
      setCreating(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Start a new course</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            disabled={creating !== null}
            onClick={() => setWithAi(true)}
            className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 text-left hover:border-brand-500 disabled:opacity-60 sm:col-span-2"
          >
            <div className="text-2xl">✨</div>
            <div className="mt-2 font-medium">Generate with AI</div>
            <p className="mt-1 text-sm text-slate-500">Describe your goal or paste source material — get a full draft course with sections, content and a quiz.</p>
          </button>
          {templates.map((t) => (
            <button
              key={t.key}
              disabled={creating !== null}
              onClick={() => create(t.key)}
              className="rounded-xl border border-slate-200 p-4 text-left hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60"
            >
              <div className="text-2xl">{t.emoji}</div>
              <div className="mt-2 font-medium">{creating === t.key ? "Creating…" : t.name}</div>
              <p className="mt-1 text-sm text-slate-500">{t.description}</p>
              <p className="mt-2 text-xs text-slate-400">
                {t.sectionCount} sections · {t.pageCount} pages
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
