import Link from "next/link";
import Form from "next/form";
import { ClipboardPlus, Megaphone, UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCents, paymentState } from "@/lib/money";
import { ANNOUNCEMENT_CATEGORY_LABEL, formatDate, formatDateShort, orderNumber } from "@/lib/labels";
import { getSummary, PERIOD_LABEL, type Period } from "@/lib/services/dashboard";
import { Flourish, PageHeader, PaymentLabel, StatusLabel, tiltFor } from "@/components/ui/bits";

export const metadata = { title: "Registro generale" };

const PERIODS: Period[] = ["oggi", "7g", "mese", "totale", "custom"];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.periodo as Period) ? (sp.periodo as Period) : "mese";
  const summary = await getSummary(prisma, period, sp.dal, sp.al);
  const now = new Date();
  const [latest, waiting, ready, payments, announcements] = await Promise.all([
    prisma.order.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.order.findMany({ where: { status: { in: ["RICEVUTO", "IN_ATTESA"] } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], take: 6 }),
    prisma.order.findMany({ where: { status: "PRONTO" }, orderBy: { dueDate: "asc" }, take: 6 }),
    prisma.payment.findMany({ where: { voidedAt: null }, orderBy: { paidAt: "desc" }, take: 8, include: { order: { select: { id: true, number: true, customerName: true } } } }),
    prisma.announcement.findMany({
      where: { status: "PUBBLICATO", archivedAt: null, publishedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 3,
    }),
  ]);
  const periodText =
    period === "custom"
      ? `dal ${sp.dal ? formatDateShort(sp.dal) : "principio"} al ${sp.al ? formatDateShort(sp.al) : "giorno d'oggi"}`
      : PERIOD_LABEL[period].toLowerCase();

  return (
    <div className="space-y-8">
      <PageHeader title="Registro generale" kicker={`Situazione al ${formatDate(now)}`}>
        <Link href="/ordini/nuovo" className="btn btn-brass">
          <ClipboardPlus size={18} aria-hidden /> Nuovo ordine
        </Link>
        <Link href="/rubrica/nuovo" className="btn btn-paper">
          <UserPlus size={18} aria-hidden /> Nuovo contatto
        </Link>
        <Link href="/strilloni/nuovo" className="btn btn-paper">
          <Megaphone size={18} aria-hidden /> Nuovo strillone
        </Link>
      </PageHeader>

      {/* Indicatori economici: piccoli registri contabili */}
      <section aria-labelledby="riepilogo">
        <h2 id="riepilogo" className="sr-only">
          Riepilogo economico
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi title="Denaro da riscuotere" value={formatCents(summary.toCollectCents)} note="Residui sugli ordini non annullati · situazione attuale" tone="text-bordeaux" />
          <Kpi
            title="Incassi complessivi"
            value={formatCents(summary.collectedCents)}
            note={`${summary.collectedCount} pagamenti · ${periodText}`}
            tone="text-olive"
          />
          <Kpi title="Valore commesse aperte" value={formatCents(summary.openValueCents)} note={`${summary.openCount} commesse non ancora consegnate`} tone="text-ink" />
          <Kpi title="Ordini in lavorazione" value={String(summary.inWorkCount)} note="Commesse sul banco da lavoro" tone="text-sepia" />
        </div>

        <Form action="/" className="no-print mt-4 flex flex-wrap items-end gap-2 rounded-[2px] bg-black/25 p-3">
          <span className="mr-1 self-center font-heading text-parchment/90">Periodo incassi:</span>
          {PERIODS.filter((p) => p !== "custom").map((p) => (
            <Link
              key={p}
              href={`/?periodo=${p}`}
              className={`btn btn-sm ${period === p ? "btn-brass" : "btn-paper"}`}
              aria-current={period === p ? "true" : undefined}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
          <input type="hidden" name="periodo" value="custom" />
          <label className="flex items-center gap-1 text-parchment/90">
            <span className="font-heading text-sm">Dal</span>
            <input type="date" name="dal" defaultValue={sp.dal} className="input !min-h-[2.1rem] !w-auto !py-0.5 !text-base" />
          </label>
          <label className="flex items-center gap-1 text-parchment/90">
            <span className="font-heading text-sm">al</span>
            <input type="date" name="al" defaultValue={sp.al} className="input !min-h-[2.1rem] !w-auto !py-0.5 !text-base" />
          </label>
          <button className={`btn btn-sm ${period === "custom" ? "btn-brass" : "btn-paper"}`}>Applica intervallo</button>
        </Form>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Ultimi ordini ricevuti" href="/ordini" className="lg:col-span-2">
          {latest.length === 0 ? (
            <Empty text="Ancora nessuna commissione registrata." />
          ) : (
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Cliente</th>
                    <th className="hidden md:table-cell">Lavorazione</th>
                    <th>Stato</th>
                    <th className="text-right">Residuo</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((o) => (
                    <tr key={o.id}>
                      <td className="num whitespace-nowrap">
                        <Link className="underline decoration-dotted underline-offset-4" href={`/ordini/${o.id}`}>
                          {orderNumber(o.number)}
                        </Link>
                      </td>
                      <td>{o.customerName}</td>
                      <td className="hidden max-w-[16rem] truncate md:table-cell">{o.title}</td>
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
        </Panel>

        <Panel title="Strilloni recenti" href="/strilloni">
          {announcements.length === 0 ? (
            <Empty text="Nessun avviso affisso." />
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-ink/15 pb-2 last:border-0">
                  <p className="font-heading text-xs tracking-widest text-bordeaux uppercase">
                    {a.pinned ? "★ " : ""}
                    {ANNOUNCEMENT_CATEGORY_LABEL[a.category]}
                  </p>
                  <Link href={`/strilloni/${a.id}`} className="font-display text-lg leading-tight hover:underline">
                    {a.title}
                  </Link>
                  <p className="user-text line-clamp-2 text-[0.95rem] text-ink-soft">{a.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Ordini in attesa">
          <OrderList orders={waiting} empty="Nessuna commessa in attesa." />
        </Panel>
        <Panel title="Pronti per la consegna">
          <OrderList orders={ready} empty="Nessun lavoro pronto sul banco." />
        </Panel>
        <Panel title="Ultimi pagamenti registrati">
          {payments.length === 0 ? (
            <Empty text="Ancora nessun incasso." />
          ) : (
            <ul className="divide-y divide-ink/15">
              {payments.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <Link href={`/ordini/${p.order.id}`} className="num text-sm underline decoration-dotted underline-offset-4">
                      {orderNumber(p.order.number)}
                    </Link>{" "}
                    <span className="truncate">{p.order.customerName}</span>
                    <span className="block font-fell text-sm italic text-ink-soft">{formatDateShort(p.paidAt)}</span>
                  </span>
                  <span className="num whitespace-nowrap text-olive">{formatCents(p.amountCents, { sign: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ title, value, note, tone }: { title: string; value: string; note: string; tone: string }) {
  return (
    <article className="paper paper-lined board-sheet sheet-in relative px-5 pb-4 pt-8" style={{ ["--tilt" as string]: tiltFor(title) }}>
      <span className="pin" aria-hidden />
      <div className="brass absolute inset-x-6 -top-3 rounded-[2px] px-2 py-1 text-center font-heading text-[0.95rem] tracking-wider">{title}</div>
      <p className={`num mt-2 pl-8 text-[1.9rem] leading-tight ${tone}`}>{value}</p>
      <p className="mt-2 pl-8 font-fell text-[0.95rem] italic leading-snug text-ink-soft">{note}</p>
    </article>
  );
}

function Panel({ title, href, children, className = "" }: { title: string; href?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`paper sheet-in min-w-0 px-5 py-5 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">{title}</h2>
        {href && (
          <Link href={href} className="font-heading text-sm text-sepia underline decoration-dotted underline-offset-4">
            Vedi tutto →
          </Link>
        )}
      </div>
      <Flourish className="mb-3 !mx-0 text-sepia/70" />
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 font-fell text-lg italic text-ink-soft">{text}</p>;
}

function OrderList({ orders, empty }: { orders: { id: string; number: number; customerName: string; title: string; dueDate: Date | null }[]; empty: string }) {
  if (orders.length === 0) return <Empty text={empty} />;
  return (
    <ul className="divide-y divide-ink/15">
      {orders.map((o) => (
        <li key={o.id} className="py-1.5">
          <Link href={`/ordini/${o.id}`} className="group block">
            <span className="num text-sm text-sepia">{orderNumber(o.number)}</span>{" "}
            <span className="group-hover:underline">{o.customerName}</span>
            <span className="block truncate font-fell text-[0.95rem] italic text-ink-soft">
              {o.title} · consegna {o.dueDate ? formatDateShort(o.dueDate) : "da concordare"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
