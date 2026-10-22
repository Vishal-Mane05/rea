"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { name: string; email: string };

const HIDDEN_ON = ["/login", "/signup", "/preview"];

/** Small floating account menu; pages keep their own headers. */
export function UserMenu() {
  const pathname = usePathname();
  const hidden = HIDDEN_ON.some((p) => pathname.startsWith(p));
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hidden) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, [hidden]);

  if (hidden || !me) return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {open && (
        <div className="mb-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
          <p className="font-medium">{me.name}</p>
          <p className="truncate text-slate-500">{me.email}</p>
          <button onClick={logout} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-left hover:bg-slate-50">
            Log out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="ml-auto grid size-10 place-items-center rounded-full bg-brand-600 font-semibold text-white shadow-lg hover:bg-brand-700"
      >
        {me.name.trim().charAt(0).toUpperCase() || "?"}
      </button>
    </div>
  );
}
