"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { del } from "@/lib/client";

export type MediaKind = "image" | "video";

export interface MediaAsset {
  id: string;
  filename: string;
  mimeType: string;
  kind: MediaKind;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string;
}

const accept: Record<MediaKind, string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/webm",
};

const formatSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const errorText: Record<string, string> = {
  unsupported_type: "That file type isn't supported. Use PNG, JPEG, WebP, GIF, MP4 or WebM.",
  too_large: "File is too large (images up to 10 MB, videos up to 200 MB).",
  empty: "The file is empty.",
};

/** Upload with progress; XHR because fetch has no upload progress events. */
function upload(file: File, onProgress: (pct: number) => void) {
  return new Promise<MediaAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status === 201 ? resolve(xhr.response as MediaAsset) : reject(new Error(errorText[xhr.response?.error] ?? `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export function MediaLibrary({ kind, onSelect, onClose }: { kind: MediaKind; onSelect: (url: string) => void; onClose: () => void }) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/media?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setError(null);
      setProgress(0);
      try {
        const asset = await upload(file, setProgress);
        if (asset.kind !== kind) {
          setError(`That's ${asset.kind === "image" ? "an image" : "a video"} — it was added to your library, but this block needs ${kind === "image" ? "an image" : "a video"}.`);
        } else {
          setAssets((a) => [asset, ...(a ?? [])]);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProgress(null);
        if (input.current) input.current.value = "";
      }
    },
    [kind],
  );

  async function remove(asset: MediaAsset) {
    if (!confirm(`Delete "${asset.filename}"? Blocks that use it will show nothing.`)) return;
    setAssets((a) => a?.filter((x) => x.id !== asset.id) ?? null);
    await del(`/api/media/${asset.id}`).catch(() => setError("Could not delete the file."));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Media library"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">{kind === "image" ? "Images" : "Videos"}</h2>
          <button onClick={onClose} className="rounded px-2 text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition-colors ${
              dragging ? "border-brand-500 bg-brand-50" : "border-slate-200"
            }`}
          >
            {progress !== null ? (
              <div className="w-full max-w-xs">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-center text-xs text-slate-500">Uploading… {progress}%</p>
              </div>
            ) : (
              <>
                <p className="text-slate-500">Drag a file here, or</p>
                <button onClick={() => input.current?.click()} className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
                  Upload {kind}
                </button>
                <p className="text-xs text-slate-400">{kind === "image" ? "PNG, JPEG, WebP or GIF · up to 10 MB" : "MP4 or WebM · up to 200 MB"}</p>
              </>
            )}
            <input ref={input} type="file" accept={accept[kind]} hidden onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          {assets === null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="text-center text-sm text-slate-400">No {kind}s yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((a) => (
                <li key={a.id} className="group relative overflow-hidden rounded-xl border border-slate-200">
                  <button onClick={() => onSelect(a.url)} className="block w-full text-left" title={`Use ${a.filename}`}>
                    <div className="grid aspect-video place-items-center bg-slate-100">
                      {a.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <video src={a.url} preload="metadata" muted className="size-full object-cover" />
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-xs font-medium">{a.filename}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatSize(a.size)}
                        {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => remove(a)}
                    className="absolute right-1 top-1 hidden rounded bg-white/90 px-1.5 text-xs text-slate-500 shadow hover:text-rose-600 group-hover:block"
                    title="Delete"
                    aria-label={`Delete ${a.filename}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Button that opens the library and reports the chosen asset URL. */
export function MediaPickerButton({ kind, onPick, label }: { kind: MediaKind; onPick: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
      >
        {label ?? "Upload / choose from library"}
      </button>
      {open && (
        <MediaLibrary
          kind={kind}
          onClose={() => setOpen(false)}
          onSelect={(url) => {
            setOpen(false);
            onPick(url);
          }}
        />
      )}
    </>
  );
}
