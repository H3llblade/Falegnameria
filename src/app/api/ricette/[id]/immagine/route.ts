import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Non autenticato", { status: 401 });
  const { id } = await params;
  const r = await prisma.recipe.findUnique({ where: { id }, select: { imageData: true, imageMime: true, updatedAt: true } });
  if (!r?.imageData || !r.imageMime) return new Response("Nessuna immagine", { status: 404 });
  return new Response(Buffer.from(r.imageData), {
    headers: {
      "Content-Type": r.imageMime,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ETag: `"${r.updatedAt.getTime()}"`,
    },
  });
}
