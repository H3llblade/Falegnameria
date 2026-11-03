import { Prisma, type OrderStatus, type PrismaClient } from "@prisma/client";
import type { z } from "zod";
import { audit } from "@/lib/audit";
import type { Tx } from "@/lib/db";
import { parseMoneyToCents } from "@/lib/money";
import { ARCHIVABLE_STATUSES } from "@/lib/labels";
import {
  contactSchema,
  orderSchema,
  paymentEditSchema,
  paymentSchema,
  paymentVoidSchema,
  parseDateInput,
} from "@/lib/validation/schemas";
import { DomainError } from "./errors";
import type { MaterialsSnapshot } from "@/lib/quantity";

type OrderData = z.output<typeof orderSchema>;

/** Blocca la riga dell'ordine per serializzare pagamenti/modifiche concorrenti */
async function lockOrder(tx: Tx, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  if (rows.length === 0) throw new DomainError("Ordine non trovato");
}

/** Ricalcola totale e incassato a partire da righe e pagamenti validi */
export async function recalcOrder(tx: Tx, orderId: string) {
  const [items, paid] = await Promise.all([
    tx.orderItem.aggregate({ where: { orderId }, _sum: { lineTotalCents: true } }),
    tx.payment.aggregate({ where: { orderId, voidedAt: null }, _sum: { amountCents: true } }),
  ]);
  const totalCents = items._sum.lineTotalCents ?? 0;
  const paidCents = paid._sum.amountCents ?? 0;
  if (paidCents > totalCents) {
    throw new DomainError(
      `Gli incassi registrati (${paidCents / 100} $) supererebbero il totale dell'ordine. Annullare o correggere prima i pagamenti.`,
    );
  }
  return tx.order.update({ where: { id: orderId }, data: { totalCents, paidCents } });
}

async function materialsSnapshot(tx: Tx, recipeId: string): Promise<MaterialsSnapshot | null> {
  const recipe = await tx.recipe.findUnique({ where: { id: recipeId }, include: { materials: { orderBy: { sortOrder: "asc" } } } });
  if (!recipe) return null;
  return {
    yield: recipe.yieldQuantity,
    materials: recipe.materials.map((m) => ({ name: m.name, quantity: m.quantity.toString(), unit: m.unit })),
  };
}

function lineValues(item: OrderData["items"][number]) {
  const quantity = Number(item.quantity);
  const unitPriceCents = parseMoneyToCents(item.unitPrice);
  const lineTotalCents = quantity * unitPriceCents;
  if (!Number.isSafeInteger(lineTotalCents) || lineTotalCents > 99_999_999_99) throw new DomainError("Importo riga troppo elevato");
  return { quantity, unitPriceCents, lineTotalCents };
}

async function resolveCustomer(tx: Tx, data: OrderData, userId: string) {
  if (data.contactMode === "existing") {
    const c = await tx.contact.findUnique({ where: { id: data.contactId } });
    if (!c) throw new DomainError("Contatto non trovato", { contactId: "Contatto inesistente" });
    return { contactId: c.id, customerName: `${c.firstName} ${c.lastName}`, customerMissive: c.missiveCode };
  }
  if (data.contactMode === "new") {
    const nc = contactSchema.parse(data.newContact ?? {});
    const c = await tx.contact.create({
      data: {
        firstName: nc.firstName,
        lastName: nc.lastName,
        missiveCode: nc.missiveCode,
        activity: nc.activity,
        city: nc.city || null,
        notes: nc.notes || null,
      },
    });
    await audit(tx, { userId, action: "create", entity: "Contact", entityId: c.id, details: { via: "ordine" } });
    return { contactId: c.id, customerName: `${c.firstName} ${c.lastName}`, customerMissive: c.missiveCode };
  }
  return { contactId: null, customerName: data.customerName, customerMissive: data.customerMissive };
}

export async function createOrder(db: PrismaClient, raw: unknown, userId: string) {
  const data = orderSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, data, userId);
    const itemsData = [];
    for (const [i, it] of data.items.entries()) {
      const recipeId = it.recipeId || null;
      itemsData.push({
        description: it.description,
        recipeId,
        sortOrder: i,
        materialsSnapshot: recipeId ? ((await materialsSnapshot(tx, recipeId)) ?? Prisma.JsonNull) : Prisma.JsonNull,
        ...lineValues(it),
      });
    }
    const order = await tx.order.create({
      data: {
        ...customer,
        title: data.title,
        description: data.description,
        dueDate: parseDateInput(data.dueDate),
        notes: data.notes || null,
        status: data.status as OrderStatus,
        items: { create: itemsData },
      },
    });
    const deposit = data.deposit ? parseMoneyToCents(data.deposit) : 0;
    if (deposit > 0) {
      await tx.payment.create({
        data: { orderId: order.id, amountCents: deposit, method: data.depositMethod || null, note: "Acconto", createdById: userId },
      });
    }
    const final = await recalcOrder(tx, order.id);
    await audit(tx, {
      userId,
      action: "create",
      entity: "Order",
      entityId: order.id,
      details: { number: order.number, totalCents: final.totalCents, deposit },
    });
    return final;
  });
}

export async function updateOrder(db: PrismaClient, orderId: string, raw: unknown, userId: string) {
  const data = orderSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const before = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const customer = await resolveCustomer(tx, data, userId);
    const existing = new Map(before.items.map((i) => [i.id, i]));
    const keepIds = new Set<string>();
    for (const [i, it] of data.items.entries()) {
      const recipeId = it.recipeId || null;
      const values = { description: it.description, recipeId, sortOrder: i, ...lineValues(it) };
      const prev = it.id ? existing.get(it.id) : undefined;
      if (prev) {
        keepIds.add(prev.id);
        // Il riepilogo materiali storico si conserva se la ricetta non cambia
        const snapshot =
          prev.recipeId === recipeId
            ? (prev.materialsSnapshot ?? Prisma.JsonNull)
            : recipeId
              ? ((await materialsSnapshot(tx, recipeId)) ?? Prisma.JsonNull)
              : Prisma.JsonNull;
        await tx.orderItem.update({ where: { id: prev.id }, data: { ...values, materialsSnapshot: snapshot } });
      } else {
        const created = await tx.orderItem.create({
          data: {
            ...values,
            orderId,
            materialsSnapshot: recipeId ? ((await materialsSnapshot(tx, recipeId)) ?? Prisma.JsonNull) : Prisma.JsonNull,
          },
        });
        keepIds.add(created.id);
      }
    }
    // Righe rimosse dall'utente
    await tx.orderItem.deleteMany({ where: { orderId, id: { notIn: [...keepIds] } } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        ...customer,
        title: data.title,
        description: data.description,
        dueDate: parseDateInput(data.dueDate),
        notes: data.notes || null,
        status: data.status as OrderStatus,
        archivedAt: ARCHIVABLE_STATUSES.includes(data.status as OrderStatus) ? before.archivedAt : null,
      },
    });
    const final = await recalcOrder(tx, orderId);
    await audit(tx, {
      userId,
      action: "update",
      entity: "Order",
      entityId: orderId,
      details: { number: before.number, totalBefore: before.totalCents, totalAfter: final.totalCents, statusBefore: before.status, statusAfter: final.status },
    });
    return final;
  });
}

export async function setOrderStatus(db: PrismaClient, orderId: string, status: OrderStatus, userId: string) {
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const before = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const o = await tx.order.update({
      where: { id: orderId },
      data: { status, archivedAt: ARCHIVABLE_STATUSES.includes(status) ? before.archivedAt : null },
    });
    await audit(tx, { userId, action: "status", entity: "Order", entityId: orderId, details: { from: before.status, to: status } });
    return o;
  });
}

export async function archiveOrder(db: PrismaClient, orderId: string, archived: boolean, userId: string) {
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (archived && !ARCHIVABLE_STATUSES.includes(o.status))
      throw new DomainError("Si possono archiviare solo ordini consegnati o annullati");
    await tx.order.update({ where: { id: orderId }, data: { archivedAt: archived ? new Date() : null } });
    await audit(tx, { userId, action: archived ? "archive" : "unarchive", entity: "Order", entityId: orderId });
  });
}

export async function duplicateOrder(db: PrismaClient, orderId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const src = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    const copy = await tx.order.create({
      data: {
        contactId: src.contactId,
        customerName: src.customerName,
        customerMissive: src.customerMissive,
        title: `${src.title} (copia)`.slice(0, 200),
        description: src.description,
        notes: src.notes,
        status: "RICEVUTO",
        items: {
          create: src.items.map((i) => ({
            description: i.description,
            recipeId: i.recipeId,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
            lineTotalCents: i.lineTotalCents,
            materialsSnapshot: i.materialsSnapshot ?? Prisma.JsonNull,
            sortOrder: i.sortOrder,
          })),
        },
      },
    });
    const final = await recalcOrder(tx, copy.id);
    await audit(tx, { userId, action: "duplicate", entity: "Order", entityId: copy.id, details: { from: src.number, number: copy.number } });
    return final;
  });
}

/**
 * Eliminazione definitiva: procedura amministrativa esplicita.
 * Consentita solo per ordini annullati o archiviati, con conferma digitata del numero.
 * Una copia completa dell'ordine viene conservata nel registro di audit.
 */
export async function deleteOrderPermanently(db: PrismaClient, orderId: string, confirmation: string, userId: string) {
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payments: true } });
    if (o.status !== "ANNULLATO" && !o.archivedAt)
      throw new DomainError("Prima di eliminare definitivamente, annullare o archiviare l'ordine");
    if (confirmation.trim() !== `ELIMINA ${o.number}`)
      throw new DomainError(`Per confermare digitare esattamente: ELIMINA ${o.number}`);
    await audit(tx, {
      userId,
      action: "delete",
      entity: "Order",
      entityId: orderId,
      details: JSON.parse(JSON.stringify(o)),
    });
    await tx.payment.deleteMany({ where: { orderId } });
    await tx.order.delete({ where: { id: orderId } });
    return o.number;
  });
}

// ---------------- Pagamenti ----------------

export async function addPayment(db: PrismaClient, orderId: string, raw: unknown, userId: string) {
  const data = paymentSchema.parse(raw);
  const amountCents = parseMoneyToCents(data.amount);
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === "ANNULLATO") throw new DomainError("Non è possibile registrare pagamenti su un ordine annullato");
    const residual = order.totalCents - order.paidCents;
    if (amountCents > residual)
      throw new DomainError(`L'importo supera il residuo dovuto (${(residual / 100).toFixed(2)} $)`, {
        amount: "Importo superiore al residuo",
      });
    const p = await tx.payment.create({
      data: {
        orderId,
        amountCents,
        method: data.method || null,
        note: data.note || null,
        paidAt: data.paidAt ? parseDateInput(data.paidAt)! : new Date(),
        createdById: userId,
      },
    });
    const final = await recalcOrder(tx, orderId);
    await audit(tx, { userId, action: "create", entity: "Payment", entityId: p.id, details: { orderId, number: order.number, amountCents } });
    return { payment: p, order: final };
  });
}

export async function editPayment(db: PrismaClient, paymentId: string, raw: unknown, userId: string) {
  const data = paymentEditSchema.parse(raw);
  const amountCents = parseMoneyToCents(data.amount);
  return db.$transaction(async (tx) => {
    const before = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!before) throw new DomainError("Pagamento non trovato");
    if (before.voidedAt) throw new DomainError("Il pagamento è già stato annullato");
    await lockOrder(tx, before.orderId);
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        amountCents,
        method: data.method || null,
        note: data.note || null,
        paidAt: data.paidAt ? parseDateInput(data.paidAt)! : before.paidAt,
      },
    });
    const final = await recalcOrder(tx, before.orderId); // lancia errore se si supera il totale
    await audit(tx, {
      userId,
      action: "correct",
      entity: "Payment",
      entityId: paymentId,
      details: {
        reason: data.reason,
        before: { amountCents: before.amountCents, paidAt: before.paidAt, method: before.method, note: before.note },
        after: { amountCents: p.amountCents, paidAt: p.paidAt, method: p.method, note: p.note },
      },
    });
    return { payment: p, order: final };
  });
}

export async function voidPayment(db: PrismaClient, paymentId: string, raw: unknown, userId: string) {
  const data = paymentVoidSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const before = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!before) throw new DomainError("Pagamento non trovato");
    if (before.voidedAt) throw new DomainError("Il pagamento è già stato annullato");
    await lockOrder(tx, before.orderId);
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: data.reason },
    });
    const final = await recalcOrder(tx, before.orderId);
    await audit(tx, { userId, action: "void", entity: "Payment", entityId: paymentId, details: { reason: data.reason, amountCents: before.amountCents } });
    return { payment: p, order: final };
  });
}
