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
