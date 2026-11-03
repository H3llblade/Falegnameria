import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { ClipboardPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { viewerFor } from "@/lib/auth/session";
import { formatCents, paymentState } from "@/lib/money";
import { formatDateShort, ORDER_STATUS_LABEL, ORDER_STATUSES, orderNumber } from "@/lib/labels";
import { EmptyState, PageHeader, PaymentLabel, Stamp, StatusLabel, StatusStamp, tiltFor } from "@/components/ui/bits";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata = { title: "Bacheca ordini" };

const SORTS: Record<string, Prisma.OrderOrderByWithRelationInput[]> = {
  recenti: [{ createdAt: "desc" }],
  vecchi: [{ createdAt: "asc" }],
  consegna: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  importo_desc: [{ totalCents: "desc" }],
  importo_asc: [{ totalCents: "asc" }],
  residuo: [{ paidCents: "asc" }, { totalCents: "desc" }],
};

export default async function OrdersBoard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await viewerFor("ordini", "/ordini");
  const q = sp.q?.trim();
  const where: Prisma.OrderWhereInput = { archivedAt: user && sp.archivio === "1" ? { not: null } : null };
  if (sp.stato && ORDER_STATUSES.includes(sp.stato as OrderStatus)) where.status = sp.stato as OrderStatus;
  else if (sp.stato === "aperti") where.status = { in: ["RICEVUTO", "IN_ATTESA", "IN_LAVORAZIONE", "PRONTO"] };
  const f = prisma.order.fields;
  if (sp.pagamento === "NON_PAGATO") Object.assign(where, { paidCents: 0, totalCents: { gt: 0 } });
  if (sp.pagamento === "PARZIALE") Object.assign(where, { paidCents: { gt: 0, lt: f.totalCents } });
  if (sp.pagamento === "PAGATO") Object.assign(where, { paidCents: { gte: f.totalCents } });
  if (q) {
    const num = Number(q.replace(/^(n[°º.]?\s*|#)/i, ""));
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerMissive: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
    ];
  }
  const orders = await prisma.order.findMany({
    where,
    orderBy: SORTS[sp.ordina ?? "recenti"] ?? SORTS.recenti,
    take: 200,
    include: { items: { select: { description: true }, orderBy: { sortOrder: "asc" }, take: 3 } },
  });

  return (
    <div>
      <PageHeader title="Bacheca ordini" kicker={sp.archivio === "1" ? "Archivio delle commissioni" : "Commissioni affisse"}>
        {user && (
          <Link href="/ordini/nuovo" className="btn btn-brass">
            <ClipboardPlus size={18} aria-hidden /> Nuovo ordine
          </Link>
        )}
      </PageHeader>

      <FilterBar
        placeholder="Cerca per cliente, codice missiva, N° ordine…"
        filters={[
          {
            name: "stato",
            label: "Stato",
            options: [
              { value: "", label: "Tutti gli stati" },
              { value: "aperti", label: "Solo aperti" },
              ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] })),
            ],
          },
          {
            name: "pagamento",
            label: "Pagamento",
            options: [
              { value: "", label: "Qualsiasi" },
              { value: "NON_PAGATO", label: "Non pagato" },
              { value: "PARZIALE", label: "Parzialmente pagato" },
              { value: "PAGATO", label: "Pagato" },
            ],
          },
          {
            name: "ordina",
            label: "Ordina per",
            options: [
              { value: "", label: "Più recenti" },
              { value: "vecchi", label: "Meno recenti" },
              { value: "consegna", label: "Data di consegna" },
              { value: "importo_desc", label: "Importo maggiore" },
              { value: "importo_asc", label: "Importo minore" },
            ],
          },
          ...(user
            ? [
                {
                  name: "archivio",
                  label: "Bacheca",
                  options: [
                    { value: "", label: "Commissioni attive" },
                    { value: "1", label: "Archivio" },
                  ],
                },
              ]
            : []),
        ]}
      />

      {orders.length === 0 ? (
        <EmptyState
          title={q || sp.stato || sp.pagamento ? "Nessuna commissione trovata" : "La bacheca è vuota"}
          action={
            user ? (
              <Link href="/ordini/nuovo" className="btn btn-ink">
                Affiggi la prima commissione
              </Link>
            ) : undefined
          }
        >
          {q || sp.stato || sp.pagamento ? "Provate a modificare i criteri di ricerca." : "Nessun foglio appeso al chiodo, per ora."}
        </EmptyState>
      ) : (
        <ul className="grid gap-x-6 gap-y-9 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((o, i) => {
            const ps = paymentState(o.totalCents, o.paidCents);
            const residual = o.totalCents - o.paidCents;
            return (
              <li key={o.id}>
                <Link
                  href={`/ordini/${o.id}`}
                  className="paper board-sheet sheet-in relative flex h-full flex-col px-5 pb-4 pt-6 focus-visible:outline-offset-4"
                  style={{ ["--tilt" as string]: tiltFor(o.id), animationDelay: `${Math.min(i, 12) * 25}ms` }}
                >
                  <span className="pin" aria-hidden />
                  <div className="flex items-start justify-between gap-2">
                    <span className="num text-sm text-sepia">{orderNumber(o.number)}</span>
                    <StatusLabel status={o.status} />
                  </div>
                  <h2 className="mt-2 font-display text-[1.3rem] leading-tight">{o.customerName}</h2>
                  {o.customerMissive && <p className="num text-xs text-ink-soft">Missiva {o.customerMissive}</p>}
                  <hr className="rule my-2" aria-hidden />
                  <p className="font-heading text-[1.05rem] leading-snug">{o.title}</p>
                  {o.items.length > 0 && (
                    <p className="mt-0.5 line-clamp-2 font-fell text-[0.95rem] italic text-ink-soft">{o.items.map((it) => it.description).join(" · ")}</p>
                  )}
                  <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 pt-4 text-[0.95rem]">
                    <dt className="font-heading text-ink-soft">Totale</dt>
                    <dd className="num text-right">{formatCents(o.totalCents)}</dd>
                    <dt className="font-heading text-ink-soft">Residuo</dt>
                    <dd className={`num text-right ${residual > 0 ? "text-bordeaux" : "text-olive"}`}>{formatCents(residual)}</dd>
                    <dt className="font-heading text-ink-soft">Consegna</dt>
                    <dd className="num text-right">{o.dueDate ? formatDateShort(o.dueDate) : "—"}</dd>
                  </dl>
                  <div className="mt-3 flex min-h-9 flex-wrap items-center justify-between gap-2">
                    <PaymentLabel state={ps} />
                    <span className="pointer-events-none flex flex-wrap items-center justify-end gap-2">
                      <StatusStamp status={o.status} />
                      {ps === "PAGATO" && o.totalCents > 0 && <Stamp tone="text-olive">Saldato</Stamp>}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
