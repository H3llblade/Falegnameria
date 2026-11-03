import type { Prisma, PrismaClient } from "@prisma/client";
import { audit } from "@/lib/audit";
import { findDuplicates, sortContacts, type DupMatch } from "@/lib/contacts";
import { contactImportSchema, contactSchema } from "@/lib/validation/schemas";
import { DomainError } from "./errors";

export type ContactFilters = { q?: string; city?: string; activity?: string; archived?: boolean; withOrders?: boolean };

export async function listContacts(db: PrismaClient, f: ContactFilters = {}) {
  const q = f.q?.trim();
  const where: Prisma.ContactWhereInput = {
    archivedAt: f.archived ? { not: null } : null,
    ...(f.city ? { city: { equals: f.city, mode: "insensitive" } } : {}),
    ...(f.activity ? { activity: { contains: f.activity, mode: "insensitive" } } : {}),
    ...(f.withOrders ? { orders: { some: {} } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { missiveCode: { contains: q, mode: "insensitive" } },
            { activity: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await db.contact.findMany({ where, include: { _count: { select: { orders: true } } }, take: 2000 });
  // Ordinamento con collazione italiana, case-insensitive e senza accenti
  return sortContacts(rows);
}

export async function duplicatesFor(
  db: PrismaClient,
  rows: { firstName: string; lastName: string; missiveCode: string }[],
  excludeId?: string,
): Promise<DupMatch[][]> {
  const existing = await db.contact.findMany({ select: { id: true, firstName: true, lastName: true, missiveCode: true } });
  return rows.map((r) => findDuplicates(r, existing, excludeId));
}

function toData(d: ReturnType<typeof contactSchema.parse>) {
  return { ...d, city: d.city || null, notes: d.notes || null };
}

export async function createContact(db: PrismaClient, raw: unknown, userId: string) {
  const d = contactSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.contact.create({ data: toData(d) });
    await audit(tx, { userId, action: "create", entity: "Contact", entityId: c.id });
    return c;
  });
}

export async function updateContact(db: PrismaClient, id: string, raw: unknown, userId: string) {
  const d = contactSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const before = await tx.contact.findUnique({ where: { id } });
    if (!before) throw new DomainError("Contatto non trovato");
    const c = await tx.contact.update({ where: { id }, data: toData(d) });
    await audit(tx, { userId, action: "update", entity: "Contact", entityId: id, details: { before } });
    return c;
  });
}

/** Elimina il contatto: gli ordini restano (contactId → NULL, dati cliente conservati nell'ordine) */
export async function deleteContact(db: PrismaClient, id: string, userId: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.contact.findUnique({ where: { id } });
    if (!c) throw new DomainError("Contatto non trovato");
    await tx.contact.delete({ where: { id } });
    await audit(tx, { userId, action: "delete", entity: "Contact", entityId: id, details: c });
  });
}

export async function archiveContact(db: PrismaClient, id: string, archived: boolean, userId: string) {
  await db.$transaction(async (tx) => {
    await tx.contact.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(tx, { userId, action: archived ? "archive" : "unarchive", entity: "Contact", entityId: id });
  });
}

export async function importContacts(db: PrismaClient, raw: unknown, userId: string, source: string) {
  const { rows } = contactImportSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const created = [];
    for (const r of rows) created.push(await tx.contact.create({ data: toData(r) }));
    await audit(tx, { userId, action: "import", entity: "Contact", details: { count: created.length, source } });
    return created.length;
  });
}
