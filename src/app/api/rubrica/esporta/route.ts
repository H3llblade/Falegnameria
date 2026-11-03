import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { csvCell } from "@/lib/contacts";
import { listContacts } from "@/lib/services/contacts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new Response("Non autenticato", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const rows = await listContacts(prisma, {
    q: sp.get("q") ?? undefined,
    city: sp.get("citta") ?? undefined,
    archived: sp.get("archivio") === "1",
    withOrders: sp.get("ordini") === "1",
  });
  const header = ["Cognome", "Nome", "Codice missiva", "Attività", "Città", "Note"];
  const lines = [header.join(";"), ...rows.map((c) => [c.lastName, c.firstName, c.missiveCode, c.activity, c.city, c.notes].map(csvCell).join(";"))];
  // BOM UTF-8 per l'apertura corretta in Excel/LibreOffice
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rubrica-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
