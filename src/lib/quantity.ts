import { groupThousands } from "@/lib/money";

/**
 * Quantità dei materiali in millesimi interi (3 decimali), per calcoli esatti.
 */

export function parseQuantityToMilli(input: string | number): number {
  const s = String(input).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(s)) throw new Error("Quantità non valida (max 3 decimali)");
  const [i, d = ""] = s.split(".");
  return Number(i) * 1000 + Number(d.padEnd(3, "0"));
}

export function milliToString(milli: number): string {
  const whole = Math.floor(milli / 1000);
  const frac = milli % 1000;
  if (frac === 0) return groupThousands(whole);
  return `${groupThousands(whole)},${String(frac).padStart(3, "0").replace(/0+$/, "")}`;
}

export type MaterialLine = { name: string; quantity: string | number; unit?: string | null };

export type ScaledMaterial = { name: string; unit: string; perUnit: string; total: string; totalMilli: number };

/** Scala i materiali per un numero di unità: 4 assi × 5 unità = 20 assi */
export function scaleMaterials(materials: MaterialLine[], units: number): ScaledMaterial[] {
  if (!Number.isInteger(units) || units < 0) throw new Error("Numero di unità non valido");
  return materials.map((m) => {
    const perMilli = parseQuantityToMilli(m.quantity);
    const totalMilli = perMilli * units;
    return {
      name: m.name,
      unit: m.unit ?? "",
      perUnit: milliToString(perMilli),
      total: milliToString(totalMilli),
      totalMilli,
    };
  });
}

/** Aggrega materiali con lo stesso nome+unità (es. più righe d'ordine) */
export function sumMaterials(lists: ScaledMaterial[][]): ScaledMaterial[] {
  const map = new Map<string, ScaledMaterial>();
  for (const list of lists) {
    for (const m of list) {
      const key = `${m.name.trim().toLowerCase()}|${m.unit.trim().toLowerCase()}`;
      const prev = map.get(key);
      if (prev) {
        prev.totalMilli += m.totalMilli;
        prev.total = milliToString(prev.totalMilli);
      } else {
        map.set(key, { ...m });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
}

// ---------------- Resa delle ricette ----------------

/** Esecuzioni necessarie per ottenere almeno `units` pezzi, se una esecuzione ne produce `yieldQty` */
export function batchesFor(units: number, yieldQty: number): number {
  if (!Number.isInteger(units) || units < 0) throw new Error("Numero di unità non valido");
  const y = Number.isInteger(yieldQty) && yieldQty > 0 ? yieldQty : 1;
  return Math.ceil(units / y);
}

export type RecipeBatchPlan = {
  batches: number;
  produced: number;
  surplus: number;
  materials: ScaledMaterial[];
};

/**
 * Materiali per produrre `units` pezzi con una ricetta che, con le quantità indicate,
 * ne produce `yieldQty` (es. 4 assi → 8 sedie). Si eseguono ricette intere: 10 pezzi con resa 8 = 2 esecuzioni.
 */
export function planRecipe(materials: MaterialLine[], yieldQty: number, units: number): RecipeBatchPlan {
  const batches = batchesFor(units, yieldQty);
  const y = Number.isInteger(yieldQty) && yieldQty > 0 ? yieldQty : 1;
  const produced = batches * y;
  return { batches, produced, surplus: produced - units, materials: scaleMaterials(materials, batches) };
}

export type MaterialsSnapshot = { yield: number; materials: { name: string; quantity: string; unit: string }[] };

/** Legge la copia della ricetta salvata sulla riga d'ordine (formato vecchio: solo array, resa 1) */
export function readSnapshot(raw: unknown): MaterialsSnapshot | null {
  if (Array.isArray(raw)) return { yield: 1, materials: raw };
  if (raw && typeof raw === "object" && Array.isArray((raw as MaterialsSnapshot).materials)) {
    const y = Number((raw as MaterialsSnapshot).yield);
    return { yield: Number.isInteger(y) && y > 0 ? y : 1, materials: (raw as MaterialsSnapshot).materials };
  }
  return null;
}
