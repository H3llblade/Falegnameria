import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { viewerFor } from "@/lib/auth/session";
import { formatCents, paymentState } from "@/lib/money";
import { formatDate, formatDateShort, formatDateTime, orderNumber } from "@/lib/labels";
import { planRecipe, readSnapshot, sumMaterials, type ScaledMaterial } from "@/lib/quantity";
import { Flourish, PaymentLabel, Stamp, StatusLabel, StatusStamp } from "@/components/ui/bits";
import { OrderActions } from "@/components/orders/order-actions";
import { PaymentsPanel } from "@/components/orders/payments-panel";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, select: { number: true } });
  return { title: o ? orderNumber(o.number) : "Ordine" };
}


export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await viewerFor("ordini", `/ordini/${id}`);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { recipe: { select: { id: true, name: true } } } },
      payments: { orderBy: { paidAt: "asc" }, include: { createdBy: { select: { displayName: true } }, voidedBy: { select: { displayName: true } } } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!order) notFound();
  const history = !user ? [] : await prisma.auditLog.findMany({
    where: { OR: [{ entity: "Order", entityId: id }, { entity: "Payment", entityId: { in: order.payments.map((p) => p.id) } }] },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { displayName: true } } },
  });

  const residual = order.totalCents - order.paidCents;
  const ps = paymentState(order.totalCents, order.paidCents);
  const materialLists: ScaledMaterial[][] = order.items.flatMap((it) => {
    const snap = readSnapshot(it.materialsSnapshot);
    if (!snap || snap.materials.length === 0) return [];
    try {
      return [planRecipe(snap.materials, snap.yield, it.quantity).materials];
    } catch {
      return [];
    }
  });
  const materials = sumMaterials(materialLists);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <article className="paper frame print-sheet sheet-in relative min-w-0 px-5 py-7 sm:px-9">
        <div className="pointer-events-none absolute right-5 top-6 flex flex-col items-end gap-2 sm:right-9">
          <StatusStamp status={order.status} animate />
          {ps === "PAGATO" && order.totalCents > 0 && (
            <Stamp tone="text-olive" animate>
              Saldato
            </Stamp>
          )}
        </div>
        <p className="font-heading text-sm tracking-[0.25em] text-sepia uppercase">Commissione di falegnameria</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">{orderNumber(order.number)}</h1>
        <p className="font-fell italic text-ink-soft">Registrata il {formatDate(order.createdAt)}</p>
        <Flourish className="!mx-0 my-4 text-sepia" />

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="field-label">Cliente</dt>
            <dd className="text-lg">
              {order.contact ? (
                <Link href={`/rubrica/${order.contact.id}`} className="underline decoration-dotted underline-offset-4">
                  {order.customerName}
                </Link>
              ) : (
                order.customerName
              )}
              {!order.contact && order.contactId === null && (
                <span className="block font-fell text-sm italic text-ink-soft">Nessuna scheda in rubrica collegata</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="field-label">Codice missiva</dt>
            <dd className="num text-lg">{order.customerMissive || "—"}</dd>
          </div>
          <div>
            <dt className="field-label">Stato</dt>
            <dd>
              <StatusLabel status={order.status} />
              {order.archivedAt && <span className="ml-2 font-fell italic text-ink-soft">(archiviato)</span>}
            </dd>
          </div>
          <div>
            <dt className="field-label">Consegna prevista</dt>
            <dd className="text-lg">{order.dueDate ? formatDate(order.dueDate) : "Da concordare"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="field-label">Oggetto</dt>
            <dd className="font-heading text-xl">{order.title}</dd>
          </div>
          {order.description && (
            <div className="sm:col-span-2">
              <dt className="field-label">Descrizione della lavorazione</dt>
              <dd className="user-text">{order.description}</dd>
            </div>
          )}
        </dl>

        <h2 className="mt-7 font-display text-xl">Articoli e lavorazioni</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Descrizione</th>
                <th className="text-right">Q.tà</th>
                <th className="text-right">Prezzo</th>
                <th className="text-right">Importo</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.description}
                    {it.recipe && (
                      <Link href={`/ricettario/${it.recipe.id}`} className="no-print block font-fell text-sm italic text-sepia underline decoration-dotted">
                        dal ricettario: {it.recipe.name}
                      </Link>
                    )}
                  </td>
                  <td className="num text-right">{it.quantity}</td>
                  <td className="num whitespace-nowrap text-right">{formatCents(it.unitPriceCents)}</td>
                  <td className="num whitespace-nowrap text-right">{formatCents(it.lineTotalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right font-heading">
                  Importo totale
                </td>
                <td className="num whitespace-nowrap pt-3 text-right text-lg">{formatCents(order.totalCents)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-right font-heading">
                  Riscosso
                </td>
                <td className="num whitespace-nowrap text-right text-olive">{formatCents(order.paidCents)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-right font-heading">
                  Residuo
                </td>
                <td className={`num whitespace-nowrap text-right text-lg ${residual > 0 ? "text-bordeaux" : "text-olive"}`}>{formatCents(residual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-right">
          <PaymentLabel state={ps} />
        </p>

        {materials.length > 0 && (
          <>
            <h2 className="mt-7 font-display text-xl">Materiali necessari</h2>
            <p className="font-fell text-sm italic text-ink-soft">Calcolati sulle quantità ordinate (arrotondate a ricette intere, secondo la resa), secondo il ricettario al momento dell&apos;ordine.</p>
            <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {materials.map((m) => (
                <li key={m.name + m.unit} className="flex justify-between gap-3 border-b border-ink/15 py-1">
                  <span>{m.name}</span>
                  <span className="num">
                    {m.total} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {order.notes && (
          <>
            <h2 className="mt-7 font-display text-xl">Note</h2>
            <p className="user-text">{order.notes}</p>
          </>
        )}
      </article>

      <aside className="no-print space-y-6">
        {user && <OrderActions id={order.id} number={order.number} status={order.status} archived={!!order.archivedAt} isAdmin={user.role === "ADMIN"} />}
        <PaymentsPanel
          orderId={order.id}
          cancelled={order.status === "ANNULLATO"}
          readOnly={!user}
          residualCents={residual}
          payments={order.payments.map((p) => ({
            id: p.id,
            amountCents: p.amountCents,
            method: p.method,
            note: p.note,
            paidAt: p.paidAt.toISOString(),
            createdBy: user ? (p.createdBy?.displayName ?? null) : null,
            voidedAt: p.voidedAt?.toISOString() ?? null,
            voidedBy: user ? (p.voidedBy?.displayName ?? null) : null,
            voidReason: user ? p.voidReason : null,
          }))}
        />
        {user && (
        <section className="paper px-5 py-5">
          <h2 className="font-display text-lg">Cronologia amministrativa</h2>
          <ul className="mt-2 space-y-1.5 text-[0.95rem]">
            {history.map((h) => (
              <li key={h.id} className="border-b border-ink/10 pb-1">
                <span className="num text-xs text-ink-soft">{formatDateTime(h.createdAt)}</span>{" "}
                <span className="font-heading">{describe(h.entity, h.action)}</span>
                {h.user && <span className="font-fell italic text-ink-soft"> — {h.user.displayName}</span>}
                {reasonOf(h.details) && <span className="block font-fell italic text-ink-soft">Motivo: {reasonOf(h.details)}</span>}
              </li>
            ))}
            {history.length === 0 && <li className="font-fell italic text-ink-soft">Nessuna voce.</li>}
          </ul>
          <p className="mt-2 font-fell text-sm italic text-ink-soft">Ultima modifica: {formatDateShort(order.updatedAt)}</p>
        </section>
        )}
      </aside>
    </div>
  );
}

function reasonOf(details: unknown): string | null {
  if (details && typeof details === "object" && "reason" in details) return String((details as { reason: unknown }).reason);
  return null;
}

function describe(entity: string, action: string): string {
  const map: Record<string, string> = {
    "Order:create": "Ordine registrato",
    "Order:update": "Ordine modificato",
    "Order:status": "Stato cambiato",
    "Order:archive": "Archiviato",
    "Order:unarchive": "Ripristinato dall'archivio",
    "Order:duplicate": "Creato per duplicazione",
    "Payment:create": "Pagamento registrato",
    "Payment:correct": "Pagamento corretto",
    "Payment:void": "Pagamento annullato",
  };
  return map[`${entity}:${action}`] ?? `${entity} · ${action}`;
}
