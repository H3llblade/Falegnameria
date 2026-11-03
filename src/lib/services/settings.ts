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
