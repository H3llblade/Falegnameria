import { z } from "zod";
import { safeParseMoney } from "@/lib/money";
import { ORDER_STATUSES, ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_PRIORITIES } from "@/lib/labels";

/**
 * Schemi condivisi tra client (React Hook Form) e server (azioni).
 * I valori arrivano come stringhe: la conversione in centesimi avviene nei servizi.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Massimo ${max} caratteri`);
const required = (label: string, max: number) => trimmed(max).min(1, `${label}: campo obbligatorio`);

export const moneyString = (label: string, opts: { optional?: boolean; allowZero?: boolean } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => (opts.optional && v === "") || safeParseMoney(v) !== null, `${label}: importo non valido`)
    .refine((v) => (opts.optional && v === "") || (safeParseMoney(v) ?? -1) >= 0, `${label}: non può essere negativo`)
    .refine(
      (v) => opts.allowZero !== false || (opts.optional && v === "") || (safeParseMoney(v) ?? 0) > 0,
      `${label}: deve essere maggiore di zero`,
    );

const dateString = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), `${label}: data non valida`);

/** Codice missiva: gli spazi vengono rimossi (non fanno parte del codice) */
export const missiveCodeSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(required("Codice missiva", 40).refine((v) => /^[\p{L}\p{N}#\-_./]+$/u.test(v), "Codice missiva: caratteri non ammessi"));

// ---------------- Contatti ----------------
export const contactSchema = z.object({
  firstName: required("Nome", 80),
  lastName: required("Cognome", 80),
  missiveCode: missiveCodeSchema,
  activity: required("Descrizione attività", 200),
  city: trimmed(80).optional().default(""),
  notes: trimmed(2000).optional().default(""),
});
export type ContactInput = z.input<typeof contactSchema>;

/** Riga di importazione: nome e cognome in un unico campo (prima parola = nome, il resto = cognome) */
export const contactImportRowSchema = z.object({
  fullName: required("Nome e cognome", 160).refine((v) => v.split(/\s+/).length >= 2, "Indicare nome e cognome"),
  missiveCode: missiveCodeSchema,
  activity: required("Descrizione attività", 200),
});

export const contactImportSchema = z.object({
  rows: z.array(contactImportRowSchema).min(1, "Nessun contatto da importare").max(300, "Massimo 300 contatti per volta"),
});

// ---------------- Ordini ----------------
export const orderItemSchema = z.object({
  id: z.string().optional(),
  recipeId: z.string().optional().default(""),
  description: required("Descrizione articolo", 300),
  quantity: z
    .string()
    .trim()
    .refine((v) => /^\d{1,6}$/.test(v) && Number(v) > 0, "Quantità: numero intero maggiore di zero"),
  unitPrice: moneyString("Prezzo unitario"),
});

export const orderSchema = z
  .object({
    contactMode: z.enum(["existing", "new", "none"]),
    contactId: z.string().optional().default(""),
    // Validato solo se contactMode === "new" (vedi superRefine): i campi nascosti non bloccano il modulo
    newContact: z
      .object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        missiveCode: z.string().optional(),
        activity: z.string().optional(),
        city: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional(),
    customerName: trimmed(160).optional().default(""),
    customerMissive: trimmed(40).optional().default(""),
    title: required("Oggetto della commissione", 200),
    description: trimmed(5000).optional().default(""),
    dueDate: dateString("Consegna prevista").optional().default(""),
    notes: trimmed(5000).optional().default(""),
    status: z.enum(ORDER_STATUSES as [string, ...string[]]),
    deposit: moneyString("Acconto", { optional: true }).optional().default(""),
    depositMethod: trimmed(60).optional().default(""),
    items: z.array(orderItemSchema).min(1, "Inserire almeno un articolo o lavorazione").max(60),
  })
  .superRefine((v, ctx) => {
    if (v.contactMode === "existing" && !v.contactId)
      ctx.addIssue({ code: "custom", path: ["contactId"], message: "Selezionare un contatto dalla rubrica" });
    if (v.contactMode === "new") {
      const r = contactSchema.safeParse(v.newContact ?? {});
      if (!r.success)
        for (const i of r.error.issues) ctx.addIssue({ ...i, path: ["newContact", ...i.path] });
    }
    if (v.contactMode === "none" && !v.customerName)
      ctx.addIssue({ code: "custom", path: ["customerName"], message: "Indicare il nome del cliente" });
  });
export type OrderInput = z.input<typeof orderSchema>;

export const paymentSchema = z.object({
  amount: moneyString("Importo", { allowZero: false }),
  method: trimmed(60).optional().default(""),
  note: trimmed(500).optional().default(""),
  paidAt: dateString("Data pagamento").optional().default(""),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const paymentEditSchema = paymentSchema.extend({
  reason: required("Motivo della correzione", 300),
});

export const paymentVoidSchema = z.object({ reason: required("Motivo dell'annullamento", 300) });

// ---------------- Ricette ----------------
export const recipeMaterialSchema = z.object({
  name: required("Materiale", 120),
  quantity: z
    .string()
    .trim()
    .refine((v) => /^\d{1,8}([.,]\d{1,3})?$/.test(v) && Number(v.replace(",", ".")) > 0, "Quantità non valida"),
  unit: trimmed(30).optional().default(""),
});

export const recipeSchema = z.object({
  name: required("Nome lavorazione", 160),
  categoryId: z.string().optional().default(""),
  description: trimmed(5000).optional().default(""),
  tools: trimmed(3000).optional().default(""),
  procedure: trimmed(10000).optional().default(""),
  timeMinutes: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,5}$/.test(v) && Number(v) > 0), "Tempo: minuti interi")
    .optional()
    .default(""),
  yieldQuantity: z
    .string()
    .trim()
    .refine((v) => /^\d{1,5}$/.test(v) && Number(v) > 0, "Resa: numero intero di unità maggiore di zero")
    .default("1"),
  materialCost: moneyString("Costo materiali", { optional: true }).optional().default(""),
  suggestedPrice: moneyString("Prezzo suggerito", { optional: true }).optional().default(""),
  notes: trimmed(5000).optional().default(""),
  materials: z.array(recipeMaterialSchema).max(80).default([]),
});
export type RecipeInput = z.input<typeof recipeSchema>;

export const purchaseProductSchema = z.object({
  id: z.string().max(40).optional().default(""),
  name: required("Prodotto", 80),
  unit: trimmed(20).optional().default(""),
  price: moneyString("Prezzo d'acquisto"),
});

export const purchaseProductsSchema = z
  .object({ products: z.array(purchaseProductSchema).max(50, "Massimo 50 prodotti") })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.products.forEach((p, i) => {
      const k = p.name.trim().toLowerCase();
      if (seen.has(k)) ctx.addIssue({ code: "custom", path: ["products", i, "name"], message: "Prodotto già presente" });
      seen.add(k);
    });
  });
export type PurchaseProductsInput = z.input<typeof purchaseProductsSchema>;

export const categorySchema = z.object({ name: required("Nome categoria", 60) });

// ---------------- Strilloni ----------------
export const announcementSchema = z
  .object({
    title: required("Titolo", 160),
    content: required("Contenuto", 10000),
    category: z.enum(ANNOUNCEMENT_CATEGORIES as [string, ...string[]]),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES as [string, ...string[]]),
    pinned: z.boolean().default(false),
    status: z.enum(["BOZZA", "PUBBLICATO"]),
    publishedAt: dateString("Data di pubblicazione").optional().default(""),
    expiresAt: dateString("Scadenza").optional().default(""),
  })
  .refine((v) => !v.expiresAt || !v.publishedAt || v.expiresAt >= v.publishedAt, {
    path: ["expiresAt"],
    message: "La scadenza deve seguire la pubblicazione",
  });
export type AnnouncementInput = z.input<typeof announcementSchema>;

// ---------------- Utenti ----------------
export const loginSchema = z.object({
  username: required("Nome utente", 60),
  password: z.string().min(1, "Password obbligatoria").max(200),
});

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Inserire la password attuale"),
    next: z.string().min(10, "Almeno 10 caratteri").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Le password non coincidono" });

export const userCreateSchema = z.object({
  username: required("Nome utente", 40).regex(/^[a-zA-Z0-9._-]+$/, "Solo lettere, numeri, . _ -"),
  displayName: required("Nome visualizzato", 80),
  password: z.string().min(10, "Almeno 10 caratteri").max(200),
  role: z.enum(["ADMIN", "STAFF"]),
});

/** "2026-11-10" → Date a mezzogiorno UTC (evita slittamenti di fuso) */
export function parseDateInput(v: string | null | undefined): Date | null {
  if (!v) return null;
  return new Date(`${v}T12:00:00.000Z`);
}
