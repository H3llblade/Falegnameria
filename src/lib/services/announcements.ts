import type { AnnouncementCategory, AnnouncementPriority, AnnouncementStatus, PrismaClient } from "@prisma/client";
import { audit } from "@/lib/audit";
import { announcementSchema, parseDateInput } from "@/lib/validation/schemas";
import { DomainError } from "./errors";

function toData(d: ReturnType<typeof announcementSchema.parse>) {
  return {
    title: d.title,
    // Il contenuto è testo semplice (emoji incluse), mai interpretato come HTML
    content: d.content.normalize("NFC"),
    category: d.category as AnnouncementCategory,
    priority: d.priority as AnnouncementPriority,
    pinned: d.pinned,
    status: d.status as AnnouncementStatus,
    publishedAt: parseDateInput(d.publishedAt) ?? new Date(),
    expiresAt: parseDateInput(d.expiresAt),
  };
}

export async function createAnnouncement(db: PrismaClient, raw: unknown, userId: string) {
  const d = announcementSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const a = await tx.announcement.create({ data: toData(d) });
    await audit(tx, { userId, action: "create", entity: "Announcement", entityId: a.id });
    return a;
  });
}

export async function updateAnnouncement(db: PrismaClient, id: string, raw: unknown, userId: string) {
  const d = announcementSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const before = await tx.announcement.findUnique({ where: { id } });
    if (!before) throw new DomainError("Strillone non trovato");
    const a = await tx.announcement.update({ where: { id }, data: toData(d) });
    await audit(tx, { userId, action: "update", entity: "Announcement", entityId: id });
    return a;
  });
}

export async function archiveAnnouncement(db: PrismaClient, id: string, archived: boolean, userId: string) {
  await db.$transaction(async (tx) => {
    await tx.announcement.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(tx, { userId, action: archived ? "archive" : "unarchive", entity: "Announcement", entityId: id });
  });
}

export async function deleteAnnouncement(db: PrismaClient, id: string, userId: string) {
  await db.$transaction(async (tx) => {
    const a = await tx.announcement.delete({ where: { id } });
    await audit(tx, { userId, action: "delete", entity: "Announcement", entityId: id, details: a });
  });
}
