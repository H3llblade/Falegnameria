import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCents, paymentState, PAYMENT_STATE_LABEL } from "@/lib/money";
import { formatDate, formatDateShort, ORDER_STATUS_LABEL, orderNumber } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** I font standard PDF usano WinAnsi: rimuove emoji e caratteri non rappresentabili */
function ansi(s: string): string {
  return s
    .replace(/[−–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/°/g, "o")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of ansi(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Non autenticato", { status: 401 });
  const { id } = await params;
  const o = await prisma.order.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, payments: { where: { voidedAt: null }, orderBy: { paidAt: "asc" } } },
  });
  if (!o) return new Response("Ordine non trovato", { status: 404 });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Commissione ${orderNumber(o.number)}`);
  pdf.setProducer("Falegnameria - Wild Lands 1900");
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const ink = rgb(0.16, 0.14, 0.11);
  const bordeaux = rgb(0.45, 0.18, 0.2);
  const paperBg = rgb(0.95, 0.91, 0.82);

  let page = pdf.addPage([595, 842]);
  const M = 50;
  let y = 790;
  const decorate = () => {
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: paperBg });
    page.drawRectangle({ x: 24, y: 24, width: 547, height: 794, borderColor: ink, borderWidth: 1.5 });
    page.drawRectangle({ x: 29, y: 29, width: 537, height: 784, borderColor: ink, borderWidth: 0.5 });
  };
  decorate();
  const ensure = (h: number) => {
    if (y - h < 60) {
      page = pdf.addPage([595, 842]);
      decorate();
      y = 790;
    }
  };
  const text = (s: string, x: number, size = 11, font = serif, color = ink) => page.drawText(ansi(s), { x, y, size, font, color });
  const right = (s: string, xr: number, size = 11, font = serif, color = ink) =>
    page.drawText(ansi(s), { x: xr - font.widthOfTextAtSize(ansi(s), size), y, size, font, color });

  // Intestazione
  const title = "FALEGNAMERIA";
  page.drawText(title, { x: (595 - bold.widthOfTextAtSize(title, 26)) / 2, y, size: 26, font: bold, color: ink });
  y -= 18;
  const sub = "Wild Lands - Anno Domini 1900";
  page.drawText(sub, { x: (595 - italic.widthOfTextAtSize(sub, 12)) / 2, y, size: 12, font: italic, color: ink });
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: 595 - M, y }, thickness: 1, color: ink });
  y -= 28;
  text(`Commissione ${orderNumber(o.number)}`, M, 18, bold);
  right(`Registrata il ${formatDate(o.createdAt)}`, 595 - M, 11, italic);
  y -= 24;

  const row = (label: string, value: string) => {
    ensure(18);
    text(label, M, 11, bold);
    const lines = wrap(value || "-", serif, 11, 380);
    for (const l of lines) {
      text(l, M + 120, 11);
      y -= 15;
    }
  };
  row("Cliente", o.customerName);
  row("Codice missiva", o.customerMissive);
  row("Oggetto", o.title);
  row("Stato", ORDER_STATUS_LABEL[o.status]);
  row("Consegna prevista", o.dueDate ? formatDate(o.dueDate) : "Da concordare");
  if (o.description) row("Lavorazione", o.description);
  y -= 10;

  // Articoli
  ensure(40);
  text("Descrizione", M, 11, bold);
  right("Q.ta", 360, 11, bold);
  right("Prezzo", 450, 11, bold);
  right("Importo", 595 - M, 11, bold);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: 595 - M, y }, thickness: 0.8, color: ink });
  y -= 15;
  for (const it of o.items) {
    const lines = wrap(it.description, serif, 11, 260);
    ensure(lines.length * 14 + 6);
    right(String(it.quantity), 360);
    right(formatCents(it.unitPriceCents), 450);
    right(formatCents(it.lineTotalCents), 595 - M);
    for (const l of lines) {
      text(l, M);
      y -= 14;
    }
    y -= 3;
  }
  page.drawLine({ start: { x: 300, y: y + 6 }, end: { x: 595 - M, y: y + 6 }, thickness: 0.8, color: ink });
  y -= 10;
  const total = (label: string, v: string, color = ink) => {
    ensure(18);
    right(label, 450, 12, bold);
    right(v, 595 - M, 12, bold, color);
    y -= 17;
  };
  total("Totale", formatCents(o.totalCents));
  total("Riscosso", formatCents(o.paidCents));
  total("Residuo", formatCents(o.totalCents - o.paidCents), o.totalCents - o.paidCents > 0 ? bordeaux : ink);
  right(`Stato pagamento: ${PAYMENT_STATE_LABEL[paymentState(o.totalCents, o.paidCents)]}`, 595 - M, 11, italic);
  y -= 26;

  if (o.payments.length) {
    ensure(30);
    text("Pagamenti registrati", M, 13, bold);
    y -= 16;
    for (const p of o.payments) {
      ensure(15);
      text(`${formatDateShort(p.paidAt)}  ${[p.note, p.method].filter(Boolean).join(" - ")}`, M);
      right(formatCents(p.amountCents), 595 - M);
      y -= 15;
    }
    y -= 10;
  }
  if (o.notes) {
    ensure(30);
    text("Note", M, 13, bold);
    y -= 16;
    for (const l of wrap(o.notes, serif, 11, 495)) {
      ensure(14);
      text(l, M);
      y -= 14;
    }
  }

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="commissione-${String(o.number).padStart(4, "0")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
