import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";

export async function audit(
  db: Db,
  entry: { userId?: string | null; action: string; entity: string; entityId?: string | null; details?: unknown },
) {
  await db.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
