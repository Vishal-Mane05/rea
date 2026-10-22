"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

// Browser-side API helpers and a tiny global save-status store.

let pending = 0;
let failed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export type SaveStatus = "idle" | "saving" | "saved" | "error";
let lastStatus: SaveStatus = "idle";

function setStatus() {
  lastStatus = pending > 0 ? "saving" : failed ? "error" : "saved";
  emit();
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lastStatus,
    () => "idle",
  );
}

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const tracked = method !== "GET";
  if (tracked) {
    pending++;
    setStatus();
  }
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
    if (tracked) failed = false;
    return (res.status === 204 ? undefined : await res.json()) as T;
  } catch (e) {
    if (tracked) failed = true;
    throw e;
  } finally {
    if (tracked) {
      pending--;
      setStatus();
    }
  }
}

export const patch = (url: string, body: unknown) => api(url, "PATCH", body);
export const post = <T,>(url: string, body: unknown = {}) => api<T>(url, "POST", body);
export const del = (url: string) => api(url, "DELETE");

/**
 * Debounced field-level autosave: call the returned function on every change,
 * and the latest value is PATCHed `delay` ms after the last call (flushed on unmount).
 */
export function useDebouncedSave(url: string, field: string, delay = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ value: unknown } | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (latest.current) {
      const { value } = latest.current;
      latest.current = null;
      patch(url, { [field]: value }).catch(() => {});
    }
  }, [url, field]);

  useEffect(() => flush, [flush]);

  return useCallback(
    (value: unknown) => {
      latest.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );
}
