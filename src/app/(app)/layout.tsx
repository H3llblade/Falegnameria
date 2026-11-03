import Link from "next/link";
import { LogOut } from "lucide-react";
import { requirePageUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";
import { Emblem } from "@/components/layout/emblem";
import { DesktopNav, MobileNav, NetworkStatus } from "@/components/layout/nav";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/dialog";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <ToastProvider>
      <ConfirmProvider>
        <NetworkStatus />
        <a href="#contenuto" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 btn btn-brass">
          Vai al contenuto
        </a>
        <header className="no-print relative px-3 pt-3 sm:px-5 sm:pt-5">
          {/* Insegna in legno */}
          <div className="plank relative mx-auto max-w-7xl rounded-[3px] border border-black/60 px-4 py-3 sm:px-8 sm:py-4">
            {[
              "left-2 top-2",
              "right-2 top-2",
              "left-2 bottom-2",
              "right-2 bottom-2",
            ].map((pos) => (
              <span key={pos} className={`nail absolute ${pos}`} aria-hidden />
            ))}
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-3 sm:gap-4">
                <Emblem className="h-12 w-12 shrink-0 sm:h-16 sm:w-16" />
                <div className="min-w-0">
                  <p className="carved truncate font-display text-[1.45rem] leading-none sm:text-[2.3rem]">Falegnameria</p>
                  <p className="mt-1 truncate font-heading text-[0.78rem] tracking-[0.25em] text-brass-light sm:text-sm">
                    Wild Lands · Anno Domini 1900
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <div className="hidden text-right lg:block">
                  <p className="font-fell text-sm italic text-parchment/70">Registro tenuto da</p>
                  <p className="font-heading text-parchment">{user.displayName}</p>
                </div>
                <form action={logoutAction} className="hidden lg:block">
                  <button className="btn btn-paper btn-sm" title="Esci">
                    <LogOut size={15} aria-hidden /> Esci
                  </button>
                </form>
                <MobileNav userName={user.displayName} />
              </div>
            </div>
            <div className="mt-3 hidden border-t border-black/30 pt-3 lg:block">
              <DesktopNav />
            </div>
          </div>
        </header>
        <main id="contenuto" className="mx-auto max-w-7xl px-3 pb-16 pt-6 sm:px-5 sm:pt-8">
          {children}
        </main>
        <footer className="no-print pb-6 text-center font-fell text-sm italic text-parchment/50">
          Bottega di falegnameria · registro ad uso interno · Wild Lands 1900
        </footer>
      </ConfirmProvider>
    </ToastProvider>
  );
}
