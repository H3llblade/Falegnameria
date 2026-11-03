import Link from "next/link";
import { FileDown, UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { indexLetter } from "@/lib/contacts";
import { listContacts } from "@/lib/services/contacts";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { FilterBar } from "@/components/ui/filter-bar";
import { ImportDialog } from "@/components/contacts/import-dialog";

export const metadata = { title: "Rubrica contatti" };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const contacts = await listContacts(prisma, {
    q: sp.q,
    city: sp.citta,
    archived: sp.archivio === "1",
    withOrders: sp.ordini === "1",
  });
  const cities = await prisma.contact.findMany({ where: { city: { not: null } }, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } });
  const groups = new Map<string, typeof contacts>();
  for (const c of contacts) {
    const l = indexLetter(c.lastName);
    groups.set(l, [...(groups.get(l) ?? []), c]);
  }
  const present = new Set(groups.keys());
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div>
      <PageHeader title="Rubrica contatti" kicker="Registro alfabetico di clienti e collaboratori">
        <Link href="/rubrica/nuovo" className="btn btn-brass">
          <UserPlus size={18} aria-hidden /> Nuovo contatto
        </Link>
        <ImportDialog />
        <a href={`/api/rubrica/esporta${exportQs ? `?${exportQs}` : ""}`} className="btn btn-paper">
          <FileDown size={18} aria-hidden /> Esporta CSV
        </a>
      </PageHeader>

      <FilterBar
        placeholder="Cerca per nome, cognome, codice missiva, attività…"
        filters={[
          { name: "citta", label: "Città", options: [{ value: "", label: "Tutte" }, ...cities.map((c) => ({ value: c.city!, label: c.city! }))] },
          { name: "ordini", label: "Clienti", options: [{ value: "", label: "Tutti i contatti" }, { value: "1", label: "Con ordini" }] },
          { name: "archivio", label: "Mostra", options: [{ value: "", label: "Attivi" }, { value: "1", label: "Archiviati" }] },
        ]}
      />

      {contacts.length === 0 ? (
        <EmptyState
          title={sp.q ? "Nessun nome corrisponde" : "La rubrica è vuota"}
          action={
            <Link href="/rubrica/nuovo" className="btn btn-ink">
              Registra un contatto
            </Link>
          }
        >
          {sp.q ? "Provate con un altro nome o codice missiva." : "Aggiungete i primi clienti, oppure importateli da uno screenshot."}
        </EmptyState>
      ) : (
        <div className="relative flex gap-0">
          {/* Linguette alfabetiche */}
          <nav aria-label="Indice alfabetico" className="no-print sticky top-3 z-10 -mr-px hidden max-h-[85vh] flex-col self-start overflow-y-auto sm:flex">
            {LETTERS.map((l) =>
              present.has(l) ? (
                <a
                  key={l}
                  href={`#lettera-${l}`}
                  className="brass mb-0.5 w-9 rounded-l-[3px] py-0.5 text-center font-display text-sm hover:brightness-110"
                >
                  {l}
                </a>
              ) : (
                <span key={l} className="mb-0.5 w-9 rounded-l-[3px] bg-wood/60 py-0.5 text-center font-display text-sm text-parchment/30" aria-hidden>
                  {l}
                </span>
              ),
            )}
          </nav>
          <div className="paper ledger-open min-w-0 flex-1 px-4 py-5 sm:px-8">
            <p className="mb-3 font-fell italic text-ink-soft">
              {contacts.length} {contacts.length === 1 ? "voce" : "voci"} in rubrica · ordinate per cognome e nome
            </p>
            {[...groups.entries()].map(([letter, list]) => (
              <section key={letter} id={`lettera-${letter}`} className="scroll-mt-4 pb-4" aria-labelledby={`h-${letter}`}>
                <h2 id={`h-${letter}`} className="flex items-center gap-3 font-display text-3xl text-bordeaux">
                  {letter}
                  <span className="h-px flex-1 bg-ink/40" aria-hidden />
                </h2>
                <ul className="divide-y divide-ink/15">
                  {list.map((c) => (
                    <li key={c.id}>
                      <Link href={`/rubrica/${c.id}`} className="grid gap-x-4 py-2 hover:bg-brass/10 sm:grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.5fr)_auto] sm:items-baseline">
                        <span className="text-[1.1rem]">
                          <span className="font-heading">{c.lastName}</span> {c.firstName}
                        </span>
                        <span className="num text-[0.95rem] text-sepia">✉ {c.missiveCode}</span>
                        <span className="truncate font-fell italic text-ink-soft">
                          {c.activity}
                          {c.city ? ` · ${c.city}` : ""}
                        </span>
                        <span className="font-heading text-sm text-ink-soft">{c._count.orders > 0 ? `${c._count.orders} ordini` : ""}</span>
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
