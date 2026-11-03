"use client";

import { useState } from "react";
import { scaleMaterials } from "@/lib/quantity";

/** Calcolo automatico dei materiali per N unità (aritmetica intera in millesimi) */
export function MaterialsCalculator({ materials }: { materials: { name: string; quantity: string; unit: string }[] }) {
  const [units, setUnits] = useState("1");
  const n = /^\d{1,5}$/.test(units) ? Number(units) : 0;
  if (materials.length === 0) return <p className="mt-2 font-fell italic text-ink-soft">Nessun materiale annotato.</p>;
  const rows = scaleMaterials(materials, n);
  return (
    <div className="mt-2">
      <label className="no-print mb-3 flex items-center gap-3">
        <span className="field-label !mb-0">Unità da produrre</span>
        <input type="number" min={1} max={99999} inputMode="numeric" className="input num !w-28" value={units} onChange={(e) => setUnits(e.target.value)} />
      </label>
      <div className="overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th>Materiale</th>
              <th className="text-right">Per unità</th>
              <th className="text-right">Totale × {n}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
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
