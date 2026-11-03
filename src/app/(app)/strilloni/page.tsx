import Link from "next/link";
import type { AnnouncementCategory, Prisma } from "@prisma/client";
import { Megaphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_LABEL } from "@/lib/labels";
import { EmptyState, PageHeader, tiltFor } from "@/components/ui/bits";
import { FilterBar } from "@/components/ui/filter-bar";
import { Poster } from "@/components/announcements/poster";

export const metadata = { title: "Strilloni" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = new Date();
  const where: Prisma.AnnouncementWhereInput = { archivedAt: sp.vista === "archivio" ? { not: null } : null };
  if (sp.vista === "bozze") where.status = "BOZZA";
  if (sp.vista === "pubblicati") where.status = "PUBBLICATO";
  if (sp.vista === "scaduti") where.expiresAt = { lt: now };
  if (sp.categoria && ANNOUNCEMENT_CATEGORIES.includes(sp.categoria as AnnouncementCategory)) where.category = sp.categoria as AnnouncementCategory;
  if (sp.q?.trim())
    where.OR = [
      { title: { contains: sp.q.trim(), mode: "insensitive" } },
      { content: { contains: sp.q.trim(), mode: "insensitive" } },
    ];
  const list = await prisma.announcement.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { priority: "desc" }, { publishedAt: "desc" }],
    take: 120,
  });

  return (
    <div>
      <PageHeader title="Strilloni" kicker="Avvisi e manifesti della bottega">
        <Link href="/strilloni/nuovo" className="btn btn-brass">
          <Megaphone size={18} aria-hidden /> Nuovo strillone
        </Link>
      </PageHeader>
      <FilterBar
        placeholder="Cerca nei manifesti…"
        filters={[
          {
            name: "categoria",
            label: "Categoria",
            options: [{ value: "", label: "Tutte" }, ...ANNOUNCEMENT_CATEGORIES.map((c) => ({ value: c, label: ANNOUNCEMENT_CATEGORY_LABEL[c] }))],
          },
          {
            name: "vista",
            label: "Mostra",
            options: [
              { value: "", label: "Tutti gli attivi" },
              { value: "pubblicati", label: "Pubblicati" },
              { value: "bozze", label: "Bozze" },
              { value: "scaduti", label: "Scaduti" },
              { value: "archivio", label: "Archivio" },
            ],
          },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState
          title="Nessun manifesto affisso"
          action={
            <Link href="/strilloni/nuovo" className="btn btn-ink">
              Scrivi uno strillone
            </Link>
          }
        >
          La parete degli avvisi attende il primo foglio.
        </EmptyState>
      ) : (
        <ul className="grid gap-x-7 gap-y-10 pt-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a, i) => (
            <li key={a.id} className={a.pinned ? "sm:col-span-2 xl:col-span-1" : ""}>
              <Link
                href={`/strilloni/${a.id}`}
                className={`paper board-sheet sheet-in relative block h-full ${a.pinned ? "outline outline-2 outline-offset-4 outline-brass/70" : ""} ${
                  a.status === "BOZZA" ? "opacity-80" : ""
                }`}
                style={{ ["--tilt" as string]: tiltFor(a.id), animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                <span className="pin" aria-hidden />
                {a.pinned && <span className="sr-only">Fissato in alto. </span>}
                <Poster compact a={{ ...a, draft: a.status === "BOZZA", expired: !!a.expiresAt && a.expiresAt < now }} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
