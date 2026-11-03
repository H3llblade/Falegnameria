"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, ClipboardList, Contact, LogOut, Megaphone, Menu, NotebookPen, Plus, Settings, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export const NAV = [
  { href: "/", label: "Registro generale", short: "Registro", icon: NotebookPen },
  { href: "/ordini", label: "Bacheca ordini", short: "Ordini", icon: ClipboardList },
  { href: "/ordini/nuovo", label: "Nuovo ordine", short: "Nuovo", icon: Plus },
  { href: "/strilloni", label: "Strilloni", short: "Strilloni", icon: Megaphone },
  { href: "/ricettario", label: "Ricettario", short: "Ricettario", icon: BookOpen },
  { href: "/rubrica", label: "Rubrica contatti", short: "Rubrica", icon: Contact },
  { href: "/impostazioni", label: "Impostazioni", short: "Impostazioni", icon: Settings },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/ordini") return path.startsWith("/ordini") && !path.startsWith("/ordini/nuovo");
  return path.startsWith(href);
}

export function DesktopNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navigazione principale" className="no-print hidden lg:block">
      <ul className="flex flex-wrap justify-center gap-2">
        {NAV.map(({ href, short, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex items-center gap-1.5 rounded-[2px] px-3.5 py-1.5 font-heading text-[1.05rem] tracking-wide transition ${
                  active ? "brass" : "text-parchment/90 hover:bg-black/20 hover:text-parchment"
                }`}
              >
                <Icon size={15} strokeWidth={1.6} aria-hidden className="opacity-80" />
                {short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileNav({ userName }: { userName: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="no-print lg:hidden">
      <button className="btn btn-brass btn-sm" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-menu">
        <Menu size={18} aria-hidden /> Menu
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Chiudi menu" onClick={() => setOpen(false)} />
          <nav id="mobile-menu" className="plank sheet-in absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="carved font-display text-xl">Bottega</span>
              <button className="btn btn-ghost btn-sm text-parchment" onClick={() => setOpen(false)} aria-label="Chiudi menu">
                <X size={20} />
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isActive(path, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-[2px] px-3 py-2.5 font-heading text-lg ${
                        active ? "brass" : "text-parchment hover:bg-black/25"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.6} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto border-t border-parchment/20 pt-4 text-parchment/80">
              <p className="mb-2 font-fell italic">Accesso: {userName}</p>
              <form action={logoutAction}>
                <button className="btn btn-paper btn-sm w-full">
                  <LogOut size={16} aria-hidden /> Esci
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

/** Avviso quando la connessione di rete cade */
export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  if (online) return null;
  return (
    <div role="alert" className="no-print sticky top-0 z-40 bg-bordeaux px-4 py-2 text-center font-heading text-parchment-light">
      Il telegrafo tace: connessione assente. Le modifiche non verranno salvate finché la linea non torna.
    </div>
  );
}
