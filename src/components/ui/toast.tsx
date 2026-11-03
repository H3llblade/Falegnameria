"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { X } from "lucide-react";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type Ctx = { push: (kind: Toast["kind"], text: string) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Toast["kind"], text: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, text }]);
      setTimeout(() => remove(id), kind === "error" ? 7000 : 4000);
    },
    [remove],
  );
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-3 z-[100] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            aria-live={t.kind === "error" ? "assertive" : "polite"}
            className={`paper sheet-in pointer-events-auto flex w-full max-w-sm items-start gap-3 border-l-[6px] px-4 py-3 ${
              t.kind === "error" ? "border-bordeaux" : t.kind === "success" ? "border-olive" : "border-brass"
            }`}
          >
            <span
              className={`stamp mt-0.5 shrink-0 !text-[0.62rem] ${t.kind === "error" ? "text-bordeaux" : t.kind === "success" ? "text-olive" : "text-sepia"}`}
            >
              {t.kind === "error" ? "Errore" : t.kind === "success" ? "Fatto" : "Avviso"}
            </span>
            <p className="flex-1 text-[0.98rem] leading-snug">{t.text}</p>
            <button className="text-ink-soft hover:text-ink" onClick={() => remove(t.id)} aria-label="Chiudi notifica">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/** Mostra il risultato di un'azione server */
export function useActionToast() {
  const { push } = useToast();
  return useCallback(
    (r: { ok: boolean; message?: string; error?: string }) => {
      if (r.ok) {
        if (r.message) push("success", r.message);
      } else push("error", r.error ?? "Operazione non riuscita");
      return r.ok;
    },
    [push],
  );
}
