import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BookPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { itCollator } from "@/lib/contacts";
import { EmptyState, Flourish, PageHeader } from "@/components/ui/bits";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata = { title: "Ricettario" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const categories = await prisma.category.findMany({ where: { kind: "RECIPE" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const where: Prisma.RecipeWhereInput = { archivedAt: sp.archivio === "1" ? { not: null } : null };
  if (sp.categoria === "nessuna") where.categoryId = null;
  else if (sp.categoria) where.categoryId = sp.categoria;
  if (sp.q?.trim()) where.name = { contains: sp.q.trim(), mode: "insensitive" };
  const recipes = await prisma.recipe.findMany({
    where,
    select: { id: true, name: true, categoryId: true, description: true, suggestedPriceCents: true, isDemo: true, _count: { select: { materials: true } } },
    take: 500,
  });
  recipes.sort((a, b) => itCollator.compare(a.name, b.name));
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: recipes.filter((r) => r.categoryId === c.id) })),
    { id: "none", name: "Senza categoria", items: recipes.filter((r) => !r.categoryId) },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader title="Ricettario" kicker="Manuale delle lavorazioni della bottega">
        <Link href="/ricettario/nuova" className="btn btn-brass">
          <BookPlus size={18} aria-hidden /> Nuova lavorazione
        </Link>
      </PageHeader>
      <FilterBar
        placeholder="Cerca una lavorazione per nome…"
        filters={[
          {
            name: "categoria",
            label: "Categoria",
            options: [{ value: "", label: "Tutte" }, ...categories.map((c) => ({ value: c.id, label: c.name })), { value: "nessuna", label: "Senza categoria" }],
          },
          { name: "archivio", label: "Mostra", options: [{ value: "", label: "Attive" }, { value: "1", label: "Archiviate" }] },
        ]}
      >
        <Link href="/impostazioni#categorie" className="btn btn-ghost btn-sm self-end">
          Gestisci categorie
        </Link>
      </FilterBar>

      {groups.length === 0 ? (
        <EmptyState
          title="Il ricettario è ancora bianco"
          action={
            <Link href="/ricettario/nuova" className="btn btn-ink">
              Annota la prima lavorazione
            </Link>
          }
        >
          Registrate come si costruiscono i lavori della bottega: materiali, attrezzi e procedimento.
        </EmptyState>
      ) : (
        /* Libro aperto: due pagine affiancate su schermi larghi */
        <div className="paper ledger-open relative grid gap-0 overflow-hidden rounded-[3px] md:grid-cols-2">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/20 to-transparent md:block" aria-hidden />
          <div className="col-span-full px-6 pb-4 pt-7 text-center">
            <p className="font-display text-3xl">Indice delle lavorazioni</p>
            <Flourish className="mt-2 text-sepia" />
          </div>
          <div className="col-span-full grid gap-0 md:grid-cols-2 md:[&>section:nth-child(odd)]:pr-10 md:[&>section:nth-child(even)]:pl-10">
            {groups.map((g) => (
              <section key={g.id} className="px-6 pb-6 sm:px-10" aria-labelledby={`cat-${g.id}`}>
                <h2 id={`cat-${g.id}`} className="border-b-2 border-double border-ink/60 pb-1 font-heading text-xl tracking-wide text-bordeaux">
                  {g.name}
                </h2>
                <ul className="mt-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <Link href={`/ricettario/${r.id}`} className="group flex items-baseline gap-2 py-1.5">
                        <span className="font-fell text-[1.12rem] group-hover:underline">{r.name}</span>
                        {r.isDemo && <span className="rounded-sm border border-sepia/70 px-1 font-heading text-[0.7rem] text-sepia uppercase">Esempio</span>}
                        <span className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-ink/50" aria-hidden />
                        <span className="num text-sm whitespace-nowrap">{r.suggestedPriceCents ? formatCents(r.suggestedPriceCents) : "—"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
