"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { ORDER_STATUSES } from "@/lib/labels";
import * as svc from "@/lib/services/orders";

const idSchema = z.string().min(1).max(40);
const refresh = () => revalidatePath("/", "layout");

export async function createOrderAction(raw: unknown): Promise<ActionResult<{ id: string; number: number }>> {
  return runAction(async () => {
    const me = await requireUser();
    const o = await svc.createOrder(prisma, raw, me.id);
    refresh();
    return { id: o.id, number: o.number };
  }, "Commissione registrata");
}

export async function updateOrderAction(id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const o = await svc.updateOrder(prisma, idSchema.parse(id), raw, me.id);
    refresh();
    return { id: o.id };
  }, "Commissione aggiornata");
}

export async function setOrderStatusAction(id: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    const s = z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]).parse(status);
    await svc.setOrderStatus(prisma, idSchema.parse(id), s, me.id);
    refresh();
  }, "Stato aggiornato");
}

export async function archiveOrderAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.archiveOrder(prisma, idSchema.parse(id), archived, me.id);
    refresh();
  }, archived ? "Commissione archiviata" : "Commissione ripristinata");
}

export async function duplicateOrderAction(id: string): Promise<ActionResult<{ id: string; number: number }>> {
  return runAction(async () => {
    const me = await requireUser();
    const o = await svc.duplicateOrder(prisma, idSchema.parse(id), me.id);
    refresh();
    return { id: o.id, number: o.number };
  }, "Commissione duplicata");
}

export async function deleteOrderAction(id: string, confirmation: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    await svc.deleteOrderPermanently(prisma, idSchema.parse(id), String(confirmation), me.id);
    refresh();
  }, "Commissione eliminata definitivamente");
}

export async function addPaymentAction(orderId: string, raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.addPayment(prisma, idSchema.parse(orderId), raw, me.id);
    refresh();
  }, "Pagamento registrato");
}

export async function editPaymentAction(paymentId: string, raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.editPayment(prisma, idSchema.parse(paymentId), raw, me.id);
    refresh();
  }, "Pagamento corretto");
}

export async function voidPaymentAction(paymentId: string, raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.voidPayment(prisma, idSchema.parse(paymentId), raw, me.id);
    refresh();
  }, "Pagamento annullato");
}
