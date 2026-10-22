"use client";

import { useState } from "react";
import { useDebouncedSave } from "@/lib/client";

interface TextFieldProps {
  url: string;
  field: string;
  value: string;
  onLocal?: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  /** send null instead of "" (for nullable url fields) */
  emptyAsNull?: boolean;
}

/** Text input that keeps its own state and autosaves one field. */
export function AutoText({ url, field, value, onLocal, placeholder, className = "", multiline, emptyAsNull }: TextFieldProps) {
  const [local, setLocal] = useState(value);
  const save = useDebouncedSave(url, field);
  const change = (v: string) => {
    setLocal(v);
    onLocal?.(v);
    save(emptyAsNull && v.trim() === "" ? null : v);
  };
  const base = `w-full bg-transparent outline-none placeholder:text-slate-400 ${className}`;
  return multiline ? (
    <textarea value={local} rows={2} placeholder={placeholder} onChange={(e) => change(e.target.value)} className={`${base} resize-y`} />
  ) : (
    <input value={local} placeholder={placeholder} onChange={(e) => change(e.target.value)} className={base} />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${checked ? "left-4.5" : "left-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

export function IconButton({ onClick, title, children, danger }: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid size-6 place-items-center rounded text-xs text-slate-400 hover:bg-slate-100 ${danger ? "hover:text-red-600" : "hover:text-slate-700"}`}
    >
      {children}
    </button>
  );
}
