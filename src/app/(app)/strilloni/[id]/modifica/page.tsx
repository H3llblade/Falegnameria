import { requirePageUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toDateInput } from "@/lib/labels";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Modifica strillone" };

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) notFound();
  return (
    <div>
      <PageHeader title="Modifica strillone" kicker={a.title} />
      <AnnouncementForm
        id={a.id}
        initial={{
          title: a.title,
          content: a.content,
          category: a.category,
          priority: a.priority,
          pinned: a.pinned,
          status: a.status,
          publishedAt: toDateInput(a.publishedAt),
          expiresAt: toDateInput(a.expiresAt),
        }}
      />
    </div>
  );
}
