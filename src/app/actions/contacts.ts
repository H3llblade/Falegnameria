"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import type { DupMatch } from "@/lib/contacts";
import * as svc from "@/lib/services/contacts";

const idSchema = z.string().min(1).max(40);
const refresh = () => revalidatePath("/", "layout");

export async function createContactAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const c = await svc.createContact(prisma, raw, me.id);
    refresh();
    return { id: c.id };
  }, "Contatto registrato");
}

export async function updateContactAction(id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const c = await svc.updateContact(prisma, idSchema.parse(id), raw, me.id);
    refresh();
    return { id: c.id };
  }, "Contatto aggiornato");
}

export async function deleteContactAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    await svc.deleteContact(prisma, idSchema.parse(id), me.id);
    refresh();
  }, "Contatto eliminato (gli ordini storici sono conservati)");
}

export async function archiveContactAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.archiveContact(prisma, idSchema.parse(id), archived, me.id);
    refresh();
  }, archived ? "Contatto archiviato" : "Contatto ripristinato");
}

const dupInput = z
  .array(z.object({ firstName: z.string().max(80), lastName: z.string().max(80), missiveCode: z.string().max(40) }))
  .max(300);

export async function checkDuplicatesAction(rows: unknown, excludeId?: string): Promise<ActionResult<DupMatch[][]>> {
  return runAction(async () => {
    await requireUser();
    return svc.duplicatesFor(prisma, dupInput.parse(rows), excludeId);
  });
}

export async function importContactsAction(raw: unknown, source: string): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const me = await requireUser();
    const count = await svc.importContacts(prisma, raw, me.id, source === "ocr" ? "ocr" : "csv");
    refresh();
    return { count };
  });
}

export async function searchContactsAction(q: string): Promise<ActionResult<{ id: string; label: string; missiveCode: string; activity: string }[]>> {
  return runAction(async () => {
    await requireUser();
    const rows = await svc.listContacts(prisma, { q: String(q).slice(0, 80) });
    return rows.slice(0, 25).map((c) => ({
      id: c.id,
      label: `${c.lastName} ${c.firstName}`,
      missiveCode: c.missiveCode,
      activity: c.activity,
    }));
  });
}
