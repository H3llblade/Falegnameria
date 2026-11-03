"use client";

import { useState } from "react";
import { planRecipe } from "@/lib/quantity";

/**
 * Calcolo dei materiali per N unità: la ricetta base produce `yieldQuantity` unità,
 * quindi si eseguono ricette intere (aritmetica intera in millesimi).
 */
export function MaterialsCalculator({
  materials,
  yieldQuantity,
}: {
  materials: { name: string; quantity: string; unit: string }[];
  yieldQuantity: number;
}) {
  const [units, setUnits] = useState(String(yieldQuantity));
  const n = /^\d{1,6}$/.test(units) ? Number(units) : 0;
  if (materials.length === 0) return <p className="mt-2 font-fell italic text-ink-soft">Nessun materiale annotato.</p>;
  const plan = planRecipe(materials, yieldQuantity, n);
  return (
    <div className="mt-2">
      <p className="font-fell italic text-ink-soft">
        Ricetta base: questi materiali producono <span className="num not-italic">{yieldQuantity}</span> unità.
      </p>
      <label className="no-print my-3 flex flex-wrap items-center gap-3">
        <span className="field-label !mb-0">Unità da produrre</span>
        <input type="number" min={1} max={999999} inputMode="numeric" className="input num !w-28" value={units} onChange={(e) => setUnits(e.target.value)} />
      </label>
      {n > 0 && (
        <p className="mb-2 text-[1.02rem]">
          Esecuzioni della ricetta: <strong className="num">{plan.batches}</strong> · unità ottenute: <strong className="num">{plan.produced}</strong>
          {plan.surplus > 0 && <span className="font-fell italic text-ink-soft"> (avanzano {plan.surplus})</span>}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th>Materiale</th>
              <th className="text-right">Per esecuzione</th>
              <th className="text-right">Totale × {plan.batches}</th>
            </tr>
          </thead>
          <tbody>
            {plan.materials.map((m, i) => (
              <tr key={i}>
                <td>{m.name}</td>
                <td className="num whitespace-nowrap text-right">
                  {m.perUnit} {m.unit}
                </td>
                <td className="num whitespace-nowrap text-right font-semibold">
                  {m.total} {m.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
