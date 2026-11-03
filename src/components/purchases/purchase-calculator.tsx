"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { formatCents } from "@/lib/money";
import { purchasePayment } from "@/lib/purchases";

type Product = { id: string; name: string; unit: string; priceCents: number };

/** Calcolo del compenso da versare a chi vende prodotti (es. legno) alla bottega */
export function PurchaseCalculator({ products }: { products: Product[] }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const { rows, totalCents } = purchasePayment(
    products.map((p) => ({ ...p, quantity: /^\d{1,6}$/.test(qty[p.id] ?? "") ? Number(qty[p.id]) : 0 })),
  );
  const missingPrice = products.some((p) => p.priceCents === 0);

  return (
    <div className="paper paper-lined max-w-3xl px-5 py-7 sm:px-10">
      <div className="pl-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <label key={p.id} className="block">
              <span className="field-label">
                {p.name} — quantità{p.unit ? ` (${p.unit})` : ""}
              </span>
              <input
                type="number"
                min={0}
                max={999999}
                inputMode="numeric"
                className="input num"
                placeholder="0"
                value={qty[p.id] ?? ""}
                onChange={(e) => setQty((cur) => ({ ...cur, [p.id]: e.target.value }))}
              />
              <span className="mt-1 block font-fell text-[0.92rem] italic text-ink-soft/80">
                {formatCents(p.priceCents)} per {p.unit || "unità"}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Prodotto</th>
                <th className="text-right">Quantità</th>
                <th className="text-right">Prezzo unitario</th>
                <th className="text-right">Importo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.quantity ? "" : "opacity-60"}>
                  <td>{r.name}</td>
                  <td className="num whitespace-nowrap text-right">
                    {r.quantity} {r.unit}
                  </td>
                  <td className="num whitespace-nowrap text-right">{formatCents(r.priceCents)}</td>
                  <td className="num whitespace-nowrap text-right">{formatCents(r.subtotalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right font-heading text-lg">
                  Da pagare al venditore
                </td>
                <td className="num whitespace-nowrap text-right text-xl font-semibold">{formatCents(totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {missingPrice && (
          <p className="mt-3 font-fell italic text-bordeaux">Alcuni prezzi sono a zero: l&apos;amministratore può impostarli in Impostazioni.</p>
        )}

        <button type="button" className="btn btn-paper btn-sm mt-4" onClick={() => setQty({})}>
          <RotateCcw size={15} aria-hidden /> Azzera
        </button>
      </div>
    </div>
  );
}
