"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import * as svc from "@/lib/services/announcements";

const idSchema = z.string().min(1).max(40);
const refresh = () => revalidatePath("/", "layout");

export async function saveAnnouncementAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const a = id
      ? await svc.updateAnnouncement(prisma, idSchema.parse(id), raw, me.id)
      : await svc.createAnnouncement(prisma, raw, me.id);
    refresh();
    return { id: a.id };
  }, id ? "Strillone aggiornato" : "Strillone affisso");
}

export async function archiveAnnouncementAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.archiveAnnouncement(prisma, idSchema.parse(id), archived, me.id);
    refresh();
  }, archived ? "Strillone archiviato" : "Strillone ripristinato");
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.deleteAnnouncement(prisma, idSchema.parse(id), me.id);
    refresh();
  }, "Strillone eliminato");
}
