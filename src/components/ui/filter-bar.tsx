"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Spinner } from "./bits";

export type FilterDef = { name: string; label: string; options: { value: string; label: string }[] };

/** Ricerca immediata e filtri sincronizzati con l'URL (navigazione senza ricaricare la pagina) */
export function FilterBar({ placeholder, filters = [], children }: { placeholder: string; filters?: FilterDef[]; children?: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, start] = useTransition();
  const first = useRef(true);

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${path}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = filters.some((f) => sp.get(f.name)) || !!sp.get("q");

  return (
    <div className="no-print paper mb-6 flex flex-col gap-3 px-4 py-3 md:flex-row md:flex-wrap md:items-end">
      <label className="relative min-w-0 flex-1 md:min-w-[16rem]">
        <span className="sr-only">Cerca</span>
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input type="search" className="input !pl-9" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {filters.map((f) => (
        <label key={f.name} className="min-w-0 md:w-48">
          <span className="field-label !text-sm">{f.label}</span>
          <select className="input cursor-pointer" value={sp.get(f.name) ?? ""} onChange={(e) => push({ [f.name]: e.target.value })}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {children}
      <div className="flex min-h-[2.6rem] items-center gap-3">
        {active && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQ("");
              start(() => router.replace(path, { scroll: false }));
            }}
          >
            <X size={15} aria-hidden /> Azzera filtri
          </button>
        )}
        {pending && <Spinner label="Ricerca…" />}
      </div>
    </div>
  );
}
