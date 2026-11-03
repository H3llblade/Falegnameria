import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatDateShort, orderNumber } from "@/lib/labels";
import { Flourish } from "@/components/ui/bits";
import { RecordActions } from "@/components/ui/record-actions";
import { MaterialsCalculator } from "@/components/recipes/materials-calculator";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.recipe.findUnique({ where: { id }, select: { name: true } });
  return { title: r?.name ?? "Lavorazione" };
}

export default async function RecipeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.recipe.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, tools: true, procedure: true, timeMinutes: true, notes: true,
      materialCostCents: true, suggestedPriceCents: true, imageMime: true, isDemo: true, archivedAt: true,
      category: true,
      materials: { orderBy: { sortOrder: "asc" } },
      orderItems: { take: 8, orderBy: { order: { createdAt: "desc" } }, select: { quantity: true, order: { select: { id: true, number: true, customerName: true, createdAt: true } } } },
    },
  });
  if (!r) notFound();
  const steps = r.procedure.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const tools = r.tools.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const margin = r.suggestedPriceCents != null && r.materialCostCents != null ? r.suggestedPriceCents - r.materialCostCents : null;

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/ricettario" className="btn btn-paper btn-sm">
          <ArrowLeft size={15} aria-hidden /> Indice del ricettario
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/ordini/nuovo?ricetta=${r.id}`} className="btn btn-olive btn-sm">
            <ClipboardPlus size={15} aria-hidden /> Crea ordine con questa lavorazione
          </Link>
          <RecordActions kind="recipe" id={r.id} archived={!!r.archivedAt} editHref={`/ricettario/${r.id}/modifica`} afterDelete="/ricettario" />
        </div>
      </div>

      <article className="paper print-sheet ledger-open grid overflow-hidden rounded-[3px] lg:grid-cols-2">
        {/* Pagina sinistra */}
        <section className="relative border-ink/20 px-6 py-8 sm:px-10 lg:border-r">
          <p className="font-heading text-sm tracking-[0.3em] text-sepia uppercase">{r.category?.name ?? "Senza categoria"}</p>
          <h1 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">{r.name}</h1>
          {r.isDemo && (
            <p className="mt-2 inline-block border border-dashed border-bordeaux px-2 py-0.5 font-heading text-sm text-bordeaux">
              Scheda dimostrativa — non è una ricetta ufficiale del server
            </p>
          )}
          {r.archivedAt && <p className="mt-1 font-fell italic text-ink-soft">(archiviata)</p>}
          <Flourish className="!mx-0 my-4 text-sepia" />
          {r.description && <p className="user-text drop-cap text-[1.1rem] leading-relaxed">{r.description}</p>}
          {r.imageMime && (
            <img src={`/api/ricette/${r.id}/immagine`} alt={`Illustrazione: ${r.name}`} className="mx-auto mt-5 max-h-72 border-[6px] border-parchment-light shadow-md sepia-[.35]" />
          )}
          <dl className="mt-6 grid grid-cols-2 gap-3 text-[1.02rem]">
            <div>
              <dt className="field-label">Tempo di lavorazione</dt>
              <dd className="num">{r.timeMinutes ? `${r.timeMinutes} min` : "—"}</dd>
            </div>
            <div>
              <dt className="field-label">Costo materiali</dt>
              <dd className="num">{r.materialCostCents != null ? formatCents(r.materialCostCents) : "—"}</dd>
            </div>
            <div>
              <dt className="field-label">Prezzo suggerito</dt>
              <dd className="num text-lg">{r.suggestedPriceCents != null ? formatCents(r.suggestedPriceCents) : "—"}</dd>
            </div>
            <div>
              <dt className="field-label">Margine indicativo</dt>
              <dd className={`num ${margin != null && margin < 0 ? "text-bordeaux" : "text-olive"}`}>{margin != null ? formatCents(margin) : "—"}</dd>
            </div>
          </dl>
          {tools.length > 0 && (
            <>
              <h2 className="mt-6 font-display text-xl">Attrezzi</h2>
              <ul className="mt-1 list-['—_'] pl-5 font-fell text-[1.08rem]">
                {tools.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Pagina destra */}
        <section className="px-6 py-8 sm:px-10">
          <h2 className="font-display text-xl">Materiali</h2>
          <MaterialsCalculator materials={r.materials.map((m) => ({ name: m.name, quantity: m.quantity.toString(), unit: m.unit }))} />
          {steps.length > 0 && (
            <>
              <h2 className="mt-7 font-display text-xl">Procedimento</h2>
              <ol className="mt-2 space-y-2">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-display text-lg text-bordeaux">{toRoman(i + 1)}.</span>
                    <span className="user-text">{s}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {r.notes && (
            <>
              <h2 className="mt-7 font-display text-xl">Annotazioni</h2>
              <p className="user-text font-fell text-[1.08rem] italic">{r.notes}</p>
            </>
          )}
          {r.orderItems.length > 0 && (
            <div className="no-print mt-7">
              <h2 className="font-display text-lg">Ultime commissioni con questa lavorazione</h2>
              <ul className="mt-1 text-[0.98rem]">
                {r.orderItems.map((it, i) => (
                  <li key={i}>
                    <Link href={`/ordini/${it.order.id}`} className="underline decoration-dotted underline-offset-4">
                      {orderNumber(it.order.number)}
                    </Link>{" "}
                    {it.order.customerName} · {it.quantity} pz · {formatDateShort(it.order.createdAt)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </article>
    </div>
  );
}

function toRoman(n: number): string {
  const map: [number, string][] = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}
