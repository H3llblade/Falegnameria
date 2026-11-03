/** Compenso per i prodotti acquistati da terzi: aritmetica intera in centesimi */

export type PurchaseLine = { id: string; name: string; unit: string; priceCents: number; quantity: number };
export type PurchaseRow = PurchaseLine & { subtotalCents: number };

export function purchasePayment(lines: PurchaseLine[]): { rows: PurchaseRow[]; totalCents: number } {
  const rows = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 0) throw new Error("Quantità non valida");
    return { ...l, subtotalCents: l.quantity * l.priceCents };
  });
  return { rows, totalCents: rows.reduce((a, r) => a + r.subtotalCents, 0) };
}
