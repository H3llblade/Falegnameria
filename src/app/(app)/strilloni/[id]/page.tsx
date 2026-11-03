import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { viewerFor } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/labels";
import { Poster } from "@/components/announcements/poster";
import { RecordActions } from "@/components/ui/record-actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.announcement.findUnique({ where: { id }, select: { title: true } });
  return { title: a?.title ?? "Strillone" };
}

export default async function AnnouncementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await viewerFor("strilloni", `/strilloni/${id}`);
  const a = await prisma.announcement.findUnique({ where: { id } });
  const now = new Date();
  if (!a) notFound();
  if (!user && (a.status !== "PUBBLICATO" || a.archivedAt || a.publishedAt > now || (a.expiresAt && a.expiresAt < now))) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/strilloni" className="btn btn-paper btn-sm">
          <ArrowLeft size={15} aria-hidden /> Bacheca strilloni
        </Link>
        {user && <RecordActions isAdmin={user.role === "ADMIN"} kind="announcement" id={a.id} archived={!!a.archivedAt} editHref={`/strilloni/${a.id}/modifica`} afterDelete="/strilloni" />}
      </div>
      <article className="paper frame print-sheet sheet-in relative">
        <Poster a={{ ...a, draft: a.status === "BOZZA", expired: !!a.expiresAt && a.expiresAt < new Date() }} />
      </article>
      {user && <p className="no-print mt-4 text-center font-fell text-sm italic text-parchment/60">
        Creato il {formatDateTime(a.createdAt)} · ultima modifica {formatDateTime(a.updatedAt)}
        {a.archivedAt ? ` · archiviato il ${formatDateTime(a.archivedAt)}` : ""}
      </p>}
    </div>
  );
}
