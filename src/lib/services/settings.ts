import type { PrismaClient } from "@prisma/client";
import { audit } from "@/lib/audit";

export const SECTIONS = ["registro", "ordini", "strilloni", "ricettario", "rubrica"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  registro: "Registro generale (riepilogo economico)",
  ordini: "Bacheca ordini (con importi e pagamenti)",
  strilloni: "Strilloni",
  ricettario: "Ricettario",
  rubrica: "Rubrica contatti",
};

const KEY = "publicSections";

/** Sezioni consultabili senza accesso. Default: tutte (sito visibile in sola lettura). */
export async function getPublicSections(db: PrismaClient): Promise<Section[]> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return [...SECTIONS];
  const v = row.value;
  return Array.isArray(v) ? (v.filter((s) => SECTIONS.includes(s as Section)) as Section[]) : [...SECTIONS];
}

export async function setPublicSections(db: PrismaClient, sections: Section[], userId: string) {
  const clean = SECTIONS.filter((s) => sections.includes(s));
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: clean }, update: { value: clean } });
  await audit(db, { userId, action: "update", entity: "Setting", entityId: KEY, details: { publicSections: clean } });
}

// ---------------- Prodotti che la bottega acquista ----------------

/** Prodotto acquistato da terzi (es. legno), con il prezzo pagato per unità in centesimi */
export type PurchaseProduct = { id: string; name: string; unit: string; priceCents: number };

const PURCHASE_KEY = "purchaseProducts";

/** Elenco iniziale, finché l'amministratore non lo modifica */
export const DEFAULT_PURCHASE_PRODUCTS: PurchaseProduct[] = [
  { id: "legno", name: "Legno", unit: "pz", priceCents: 0 },
  { id: "legno-pregiato", name: "Legno pregiato", unit: "pz", priceCents: 0 },
];

export async function getPurchaseProducts(db: PrismaClient): Promise<PurchaseProduct[]> {
  const row = await db.appSetting.findUnique({ where: { key: PURCHASE_KEY } });
  if (!row || !Array.isArray(row.value)) return DEFAULT_PURCHASE_PRODUCTS.map((p) => ({ ...p }));
  return (row.value as Partial<PurchaseProduct>[]).flatMap((p) =>
    p && typeof p.id === "string" && typeof p.name === "string" && Number.isSafeInteger(p.priceCents) && (p.priceCents as number) >= 0
      ? [{ id: p.id, name: p.name, unit: typeof p.unit === "string" ? p.unit : "", priceCents: p.priceCents as number }]
      : [],
  );
}

export async function setPurchaseProducts(db: PrismaClient, products: PurchaseProduct[], userId: string) {
  await db.appSetting.upsert({
    where: { key: PURCHASE_KEY },
    create: { key: PURCHASE_KEY, value: products },
    update: { value: products },
  });
  await audit(db, { userId, action: "update", entity: "Setting", entityId: PURCHASE_KEY, details: { products } });
}
