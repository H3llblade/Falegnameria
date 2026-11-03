"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/services/errors";
import * as svc from "@/lib/services/recipes";

const idSchema = z.string().min(1).max(40);
const refresh = () => revalidatePath("/", "layout");

async function readImage(form: FormData): Promise<svc.ImageChange> {
  const mode = String(form.get("imageMode") || "keep");
  if (mode === "remove") return { kind: "remove" };
  const file = form.get("image");
  if (mode === "set" && file instanceof File && file.size > 0) {
    if (file.size > svc.MAX_IMAGE_BYTES) throw new DomainError("Immagine troppo grande (max 2 MB)");
    return { kind: "set", data: new Uint8Array(await file.arrayBuffer()) };
  }
  return { kind: "keep" };
}

function readJson(form: FormData): unknown {
  const raw = form.get("data");
  if (typeof raw !== "string" || raw.length > 200_000) throw new DomainError("Dati non validi");
  return JSON.parse(raw);
}

export async function saveRecipeAction(id: string | null, form: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const data = readJson(form);
    const img = await readImage(form);
    const r = id
      ? await svc.updateRecipe(prisma, idSchema.parse(id), data, img, me.id)
      : await svc.createRecipe(prisma, data, img, me.id);
    refresh();
    return { id: r.id };
  }, id ? "Lavorazione aggiornata" : "Lavorazione registrata nel ricettario");
}

export async function duplicateRecipeAction(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const r = await svc.duplicateRecipe(prisma, idSchema.parse(id), me.id);
    refresh();
    return { id: r.id };
  }, "Lavorazione duplicata");
}

export async function archiveRecipeAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.archiveRecipe(prisma, idSchema.parse(id), archived, me.id);
    refresh();
  }, archived ? "Lavorazione archiviata" : "Lavorazione ripristinata");
}

export async function deleteRecipeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    await svc.deleteRecipe(prisma, idSchema.parse(id), me.id);
    refresh();
  }, "Lavorazione eliminata (gli ordini conservano i propri dati)");
}

export async function createCategoryAction(raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.createCategory(prisma, raw, me.id);
    refresh();
  }, "Categoria aggiunta");
}

export async function renameCategoryAction(id: string, raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    await svc.renameCategory(prisma, idSchema.parse(id), raw, me.id);
    refresh();
  }, "Categoria rinominata");
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    await svc.deleteCategory(prisma, idSchema.parse(id), me.id);
    refresh();
  }, "Categoria eliminata");
}
