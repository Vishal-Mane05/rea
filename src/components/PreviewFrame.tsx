"use client";

import Link from "next/link";
import { useState } from "react";

const devices = [
  { key: "desktop", label: "Desktop", width: "100%" },
  { key: "tablet", label: "Tablet", width: "820px" },
  { key: "mobile", label: "Mobile", width: "390px" },
] as const;

export function PreviewFrame({ courseId }: { courseId: string }) {
  const [device, setDevice] = useState<(typeof devices)[number]["key"]>("desktop");
  const [nonce, setNonce] = useState(0);
  const width = devices.find((d) => d.key === device)!.width;
  const src = `/player/index.html?src=${encodeURIComponent(`/api/courses/${courseId}/package`)}&preview=1`;

  return (
    <div className="flex h-screen flex-col bg-slate-800">
      <header className="flex items-center gap-4 bg-slate-900 px-4 py-2 text-sm text-slate-200">
        <Link href={`/courses/${courseId}`} className="hover:text-white">
          ← Back to editor
        </Link>
        <span className="flex-1 text-center font-medium">Preview</span>
        <div className="flex gap-1 rounded-lg bg-slate-800 p-0.5">
          {devices.map((d) => (
            <button
              key={d.key}
              onClick={() => setDevice(d.key)}
              className={`rounded-md px-3 py-1 ${device === d.key ? "bg-brand-600 text-white" : "hover:bg-slate-700"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button onClick={() => setNonce((n) => n + 1)} className="rounded-md px-3 py-1 hover:bg-slate-700" title="Restart preview">
          ↻ Restart
        </button>
      </header>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-4">
        <iframe
          key={nonce}
          src={src}
          title="Course preview"
          style={{ width, maxWidth: "100%" }}
          className="h-full rounded-lg bg-white shadow-2xl transition-[width]"
        />
      </div>
    </div>
  );
}
