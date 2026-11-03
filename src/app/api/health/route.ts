import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Controllo di salute per deploy e monitoraggio: non espone dati sensibili */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", db: "ok", version: process.env.APP_VERSION ?? "dev", latencyMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
