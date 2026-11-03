import { describe, expect, it } from "vitest";
import { batchesFor, planRecipe, readSnapshot } from "@/lib/quantity";
import { purchasePayment } from "@/lib/purchases";

describe("resa delle ricette", () => {
  const mats = [
    { name: "Assi di pino", quantity: "2", unit: "pz" },
    { name: "Colla", quantity: "0,25", unit: "l" },
  ];

  it("una ricetta da 8 unità basta per 1–8 pezzi", () => {
    expect(batchesFor(1, 8)).toBe(1);
    expect(batchesFor(8, 8)).toBe(1);
    expect(batchesFor(9, 8)).toBe(2);
    expect(batchesFor(0, 8)).toBe(0);
  });

  it("calcola esecuzioni, avanzi e materiali totali", () => {
    const p = planRecipe(mats, 8, 20);
    expect(p.batches).toBe(3);
    expect(p.produced).toBe(24);
    expect(p.surplus).toBe(4);
    expect(p.materials.map((m) => m.total)).toEqual(["6", "0,75"]);
    expect(p.materials[0].perUnit).toBe("2");
  });

  it("resa non valida equivale a 1", () => {
    expect(planRecipe(mats, 0, 3).batches).toBe(3);
  });

  it("legge sia le copie vecchie (array) sia le nuove", () => {
    expect(readSnapshot(mats)).toEqual({ yield: 1, materials: mats });
    expect(readSnapshot({ yield: 8, materials: mats })).toEqual({ yield: 8, materials: mats });
    expect(readSnapshot(null)).toBeNull();
  });
});

describe("acquisti", () => {
  it("somma gli importi in centesimi", () => {
    const r = purchasePayment([
      { id: "legno", name: "Legno", unit: "pz", priceCents: 35, quantity: 120 },
      { id: "legno-pregiato", name: "Legno pregiato", unit: "pz", priceCents: 150, quantity: 7 },
    ]);
    expect(r.rows.map((x) => x.subtotalCents)).toEqual([4200, 1050]);
    expect(r.totalCents).toBe(5250);
  });
});
