import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/labels";
import { PageHeader } from "@/components/ui/bits";
import { CategoriesManager, PasswordForm, PublicSectionsForm, SessionsBox, UsersManager } from "@/components/settings/settings-forms";
import { getPublicSections, SECTION_LABEL, SECTIONS } from "@/lib/services/settings";

export const metadata = { title: "Impostazioni" };

const ACTION_LABEL: Record<string, string> = {
  create: "creazione",
  update: "modifica",
  delete: "eliminazione",
  archive: "archiviazione",
  unarchive: "ripristino",
  status: "cambio stato",
  duplicate: "duplicazione",
  correct: "correzione",
  void: "annullamento",
  import: "importazione",
  login: "accesso",
  login_failed: "accesso fallito",
  password_change: "cambio password",
  logout_all: "chiusura sessioni",
  activate: "riattivazione",
  password_reset: "nuova password",
  bootstrap: "creazione iniziale",
  deactivate: "disattivazione",
};

const ENTITY_LABEL: Record<string, string> = {
  Order: "Ordine",
  Payment: "Pagamento",
  Contact: "Contatto",
  Recipe: "Ricetta",
  Category: "Categoria",
  Setting: "Impostazione",
  Announcement: "Strillone",
  User: "Utente",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const me = await requirePageUser();
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const [categories, users, sessions, logs, logCount, counts] = await Promise.all([
    prisma.category.findMany({ where: { kind: "RECIPE" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { recipes: true } } } }),
    me.role === "ADMIN"
      ? prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, username: true, displayName: true, role: true, active: true, lastLoginAt: true } })
      : Promise.resolve([]),
    prisma.session.count({ where: { userId: me.id, expiresAt: { gt: new Date() } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { user: { select: { displayName: true } } } }),
    prisma.auditLog.count(),
    Promise.all([prisma.order.count(), prisma.payment.count(), prisma.contact.count(), prisma.recipe.count(), prisma.announcement.count()]),
  ]);
  const pages = Math.max(1, Math.ceil(logCount / 50));

  return (
    <div className="space-y-8">
      <PageHeader title="Impostazioni" kicker="Amministrazione della bottega" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="paper px-6 py-6">
          <h2 className="font-display text-xl">Parola d&apos;ordine</h2>
          <PasswordForm />
        </section>
        <section className="paper px-6 py-6">
          <h2 className="font-display text-xl">Sessioni e registro</h2>
          <SessionsBox count={sessions} />
          <dl className="mt-5 grid grid-cols-2 gap-2 text-[0.98rem] sm:grid-cols-3">
            {(
              [
                ["Ordini", counts[0]],
                ["Pagamenti", counts[1]],
                ["Contatti", counts[2]],
                ["Ricette", counts[3]],
                ["Strilloni", counts[4]],
              ] as const
            ).map(([l, n]) => (
              <div key={l} className="border border-ink/20 px-3 py-2">
                <dt className="font-heading text-ink-soft">{l}</dt>
                <dd className="num text-lg">{n}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 font-fell text-sm italic text-ink-soft">
            I backup del database sono eseguiti sul server (script <span className="num not-italic">scripts/backup.sh</span>) e conservati fuori
            dalla cartella del sito. Vedere la documentazione di deploy per ripristino e periodicità.
          </p>
        </section>
      </div>

      <section id="categorie" className="paper scroll-mt-6 px-6 py-6">
        <h2 className="font-display text-xl">Categorie del ricettario</h2>
        <CategoriesManager isAdmin={me.role === "ADMIN"} categories={categories.map((c) => ({ id: c.id, name: c.name, count: c._count.recipes }))} />
      </section>

      {me.role === "ADMIN" && (
        <section className="paper px-6 py-6">
          <h2 className="font-display text-xl">Visibilità pubblica</h2>
          <PublicSectionsForm sections={[...SECTIONS]} labels={SECTION_LABEL} initial={await getPublicSections(prisma)} />
        </section>
      )}

      {me.role === "ADMIN" && (
        <section className="paper px-6 py-6">
          <h2 className="font-display text-xl">Utenti e gestori</h2>
          <UsersManager meId={me.id} users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))} />
        </section>
      )}

      <section className="paper px-6 py-6">
        <h2 className="font-display text-xl">Registro di controllo</h2>
        <p className="font-fell italic text-ink-soft">Ogni operazione di scrittura viene annotata con data, autore e dettagli.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Data</th>
                <th>Utente</th>
                <th>Operazione</th>
                <th>Dettagli</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="num whitespace-nowrap text-sm">{formatDateTime(l.createdAt)}</td>
                  <td>{l.user?.displayName ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    {ENTITY_LABEL[l.entity] ?? l.entity} · {ACTION_LABEL[l.action] ?? l.action}
                  </td>
                  <td className="max-w-md truncate font-type text-xs text-ink-soft" title={summary(l.details)}>
                    {summary(l.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav className="mt-3 flex items-center gap-2" aria-label="Pagine del registro">
            {page > 1 && (
              <a className="btn btn-paper btn-sm" href={`?pagina=${page - 1}`}>
                ← Più recenti
              </a>
            )}
            <span className="font-fell italic">
              Pagina {page} di {pages}
            </span>
            {page < pages && (
              <a className="btn btn-paper btn-sm" href={`?pagina=${page + 1}`}>
                Più vecchi →
              </a>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

function summary(d: unknown): string {
  if (!d) return "";
  const s = JSON.stringify(d);
  return s.length > 300 ? s.slice(0, 300) + "…" : s;
}
