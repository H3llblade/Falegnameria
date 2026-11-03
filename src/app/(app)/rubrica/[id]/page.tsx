import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { viewerFor } from "@/lib/auth/session";
import { formatCents, paymentState } from "@/lib/money";
import { formatDateShort, orderNumber } from "@/lib/labels";
import { Flourish, PaymentLabel, StatusLabel } from "@/components/ui/bits";
import { RecordActions } from "@/components/ui/record-actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.contact.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  return { title: c ? `${c.lastName} ${c.firstName}` : "Contatto" };
}

export default async function ContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await viewerFor("rubrica", `/rubrica/${id}`);
  const c = await prisma.contact.findUnique({ where: { id }, include: { orders: { orderBy: { createdAt: "desc" } } } });
  if (!c || (!user && c.archivedAt)) notFound();
  const due = c.orders.filter((o) => o.status !== "ANNULLATO").reduce((s, o) => s + (o.totalCents - o.paidCents), 0);
  const paid = c.orders.reduce((s, o) => s + o.paidCents, 0);
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/rubrica" className="btn btn-paper btn-sm">
          <ArrowLeft size={15} aria-hidden /> Rubrica
        </Link>
        {user && <div className="flex flex-wrap gap-2">
          <Link href={`/ordini/nuovo?contatto=${c.id}`} className="btn btn-olive btn-sm">
            <ClipboardPlus size={15} aria-hidden /> Nuovo ordine per questo cliente
          </Link>
          <RecordActions kind="contact" id={c.id} archived={!!c.archivedAt} editHref={`/rubrica/${c.id}/modifica`} afterDelete="/rubrica" isAdmin={user.role === "ADMIN"} />
        </div>}
      </div>

      <article className="paper frame print-sheet sheet-in mx-auto max-w-3xl px-6 py-8 sm:px-10">
        <p className="font-heading text-sm tracking-[0.3em] text-sepia uppercase">Scheda di rubrica</p>
        <h1 className="font-display text-3xl sm:text-4xl">
          {c.lastName} <span className="font-fell">{c.firstName}</span>
        </h1>
        {c.archivedAt && <p className="font-fell italic text-ink-soft">(archiviato)</p>}
        <Flourish className="!mx-0 my-4 text-sepia" />
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="field-label">Codice missiva</dt>
            <dd className="num text-xl">{c.missiveCode}</dd>
          </div>
          <div>
            <dt className="field-label">Città</dt>
            <dd className="text-lg">{c.city || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="field-label">Attività</dt>
            <dd className="text-lg">{c.activity}</dd>
          </div>
          {c.notes && (
            <div className="sm:col-span-2">
              <dt className="field-label">Note</dt>
              <dd className="user-text">{c.notes}</dd>
            </div>
          )}
          <div>
            <dt className="field-label">Totale versato</dt>
            <dd className="num text-olive">{formatCents(paid)}</dd>
          </div>
          <div>
            <dt className="field-label">Ancora da riscuotere</dt>
            <dd className={`num ${due > 0 ? "text-bordeaux" : ""}`}>{formatCents(due)}</dd>
          </div>
        </dl>

        <h2 className="mt-8 font-display text-xl">Commissioni del cliente</h2>
        {c.orders.length === 0 ? (
          <p className="mt-2 font-fell italic text-ink-soft">Nessun ordine registrato.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Data</th>
                  <th>Oggetto</th>
                  <th>Stato</th>
                  <th className="text-right">Residuo</th>
                </tr>
              </thead>
              <tbody>
                {c.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="num">
                      <Link href={`/ordini/${o.id}`} className="underline decoration-dotted underline-offset-4">
                        {orderNumber(o.number)}
                      </Link>
                    </td>
                    <td className="num whitespace-nowrap">{formatDateShort(o.createdAt)}</td>
                    <td>{o.title}</td>
                    <td>
                      <StatusLabel status={o.status} />
                    </td>
                    <td className="num whitespace-nowrap text-right">
                      {formatCents(o.totalCents - o.paidCents)}
                      <div>
                        <PaymentLabel state={paymentState(o.totalCents, o.paidCents)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
