import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Emblem } from "@/components/layout/emblem";
import { Flourish } from "@/components/ui/bits";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accesso" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const hasUsers = (await prisma.user.count()) > 0;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="paper frame sheet-in w-full max-w-md px-7 py-9 sm:px-10">
        <div className="flex flex-col items-center text-center">
          <Emblem className="h-20 w-20" />
          <h1 className="mt-3 font-display text-3xl text-ink">Falegnameria</h1>
          <p className="font-heading text-sm tracking-[0.25em] text-sepia">Wild Lands · Anno Domini 1900</p>
          <Flourish className="my-4 text-sepia" />
          <p className="font-fell italic text-ink-soft">Registro riservato al titolare della bottega.</p>
        </div>
        {hasUsers ? (
          <LoginForm next={next ?? "/"} />
        ) : (
          <div className="mt-6 border border-dashed border-bordeaux/60 p-4 text-[0.98rem]">
            <p className="font-heading text-bordeaux">Nessun amministratore registrato.</p>
            <p className="mt-1">
              Creare il primo account dal terminale del server con <code className="num">npm run admin:create</code>. Per
              sicurezza non esiste alcuna registrazione dal sito.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
