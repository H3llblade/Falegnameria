import { Prisma, type PrismaClient } from "@prisma/client";
import { audit } from "@/lib/audit";
import { parseMoneyToCents } from "@/lib/money";
import { categorySchema, recipeSchema } from "@/lib/validation/schemas";
import { DomainError } from "./errors";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Verifica i "magic bytes": il tipo dichiarato dal browser non è attendibile */
export function sniffImage(buf: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length > 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

function toData(d: ReturnType<typeof recipeSchema.parse>) {
  return {
    name: d.name,
    categoryId: d.categoryId || null,
    description: d.description,
    tools: d.tools,
    procedure: d.procedure,
    timeMinutes: d.timeMinutes ? Number(d.timeMinutes) : null,
    materialCostCents: d.materialCost ? parseMoneyToCents(d.materialCost) : null,
    suggestedPriceCents: d.suggestedPrice ? parseMoneyToCents(d.suggestedPrice) : null,
    notes: d.notes || null,
  };
}

function materialsData(d: ReturnType<typeof recipeSchema.parse>) {
  return d.materials.map((m, i) => ({
    name: m.name,
    quantity: new Prisma.Decimal(m.quantity.replace(",", ".")),
    unit: m.unit,
    sortOrder: i,
  }));
}

export type ImageChange = { kind: "keep" } | { kind: "remove" } | { kind: "set"; data: Uint8Array };

function imageData(img: ImageChange) {
  if (img.kind === "remove") return { imageData: null, imageMime: null };
  if (img.kind === "set") {
    if (img.data.length > MAX_IMAGE_BYTES) throw new DomainError("Immagine troppo grande (max 2 MB)");
    const mime = sniffImage(img.data);
    if (!mime) throw new DomainError("Formato immagine non supportato (PNG, JPEG o WebP)");
    return { imageData: Buffer.from(img.data), imageMime: mime };
  }
  return {};
}

export async function createRecipe(db: PrismaClient, raw: unknown, img: ImageChange, userId: string) {
  const d = recipeSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const r = await tx.recipe.create({ data: { ...toData(d), ...imageData(img), materials: { create: materialsData(d) } } });
    await audit(tx, { userId, action: "create", entity: "Recipe", entityId: r.id });
    return r;
  });
}

/** Le modifiche valgono per il futuro: gli ordini conservano la propria copia di prezzi e materiali */
export async function updateRecipe(db: PrismaClient, id: string, raw: unknown, img: ImageChange, userId: string) {
  const d = recipeSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.recipeMaterial.deleteMany({ where: { recipeId: id } });
    const r = await tx.recipe.update({
      where: { id },
      data: { ...toData(d), ...imageData(img), isDemo: false, materials: { create: materialsData(d) } },
    });
    await audit(tx, { userId, action: "update", entity: "Recipe", entityId: id });
    return r;
  });
}

export async function duplicateRecipe(db: PrismaClient, id: string, userId: string) {
  return db.$transaction(async (tx) => {
    const src = await tx.recipe.findUniqueOrThrow({ where: { id }, include: { materials: true } });
    const r = await tx.recipe.create({
      data: {
        name: `${src.name} (copia)`.slice(0, 160),
        categoryId: src.categoryId,
        description: src.description,
        tools: src.tools,
        procedure: src.procedure,
        timeMinutes: src.timeMinutes,
        materialCostCents: src.materialCostCents,
        suggestedPriceCents: src.suggestedPriceCents,
        notes: src.notes,
        imageData: src.imageData,
        imageMime: src.imageMime,
        isDemo: src.isDemo,
        materials: { create: src.materials.map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit, sortOrder: m.sortOrder })) },
      },
    });
    await audit(tx, { userId, action: "duplicate", entity: "Recipe", entityId: r.id, details: { from: id } });
    return r;
  });
}

export async function archiveRecipe(db: PrismaClient, id: string, archived: boolean, userId: string) {
  await db.$transaction(async (tx) => {
    await tx.recipe.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(tx, { userId, action: archived ? "archive" : "unarchive", entity: "Recipe", entityId: id });
  });
}

/** Gli ordini collegati mantengono descrizione, prezzi e materiali copiati (recipeId → NULL) */
export async function deleteRecipe(db: PrismaClient, id: string, userId: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.recipe.findUniqueOrThrow({ where: { id }, include: { materials: true } });
    await tx.recipe.delete({ where: { id } });
    await audit(tx, {
      userId,
      action: "delete",
      entity: "Recipe",
      entityId: id,
      details: { ...r, imageData: r.imageData ? "[immagine]" : null, materials: r.materials.map((m) => ({ ...m, quantity: m.quantity.toString() })) },
    });
  });
}

// ---------------- Categorie ----------------

export async function createCategory(db: PrismaClient, raw: unknown, userId: string) {
  const d = categorySchema.parse(raw);
  const exists = await db.category.findFirst({ where: { kind: "RECIPE", name: { equals: d.name, mode: "insensitive" } } });
  if (exists) throw new DomainError("Esiste già una categoria con questo nome");
  const max = await db.category.aggregate({ _max: { sortOrder: true } });
  const c = await db.category.create({ data: { kind: "RECIPE", name: d.name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await audit(db, { userId, action: "create", entity: "Category", entityId: c.id, details: { name: c.name } });
  return c;
}

export async function renameCategory(db: PrismaClient, id: string, raw: unknown, userId: string) {
  const d = categorySchema.parse(raw);
  const exists = await db.category.findFirst({
    where: { kind: "RECIPE", id: { not: id }, name: { equals: d.name, mode: "insensitive" } },
  });
  if (exists) throw new DomainError("Esiste già una categoria con questo nome");
  const c = await db.category.update({ where: { id }, data: { name: d.name } });
  await audit(db, { userId, action: "update", entity: "Category", entityId: id, details: { name: d.name } });
  return c;
}

export async function deleteCategory(db: PrismaClient, id: string, userId: string) {
  const c = await db.category.delete({ where: { id } }); // ricette → categoria NULL
  await audit(db, { userId, action: "delete", entity: "Category", entityId: id, details: { name: c.name } });
}
