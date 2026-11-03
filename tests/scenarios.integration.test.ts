/**
 * Scenari dei criteri di qualità, eseguiti sui servizi reali e su PostgreSQL.
 * Richiede TEST_DATABASE_URL (database dedicato, viene svuotato).
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createContact, deleteContact, importContacts } from "@/lib/services/contacts";
import { addPayment, createOrder, editPayment, updateOrder, voidPayment } from "@/lib/services/orders";
import { createRecipe, updateRecipe } from "@/lib/services/recipes";
import { createAnnouncement, updateAnnouncement } from "@/lib/services/announcements";
import { getSummary } from "@/lib/services/dashboard";
import { paymentState } from "@/lib/money";
import { planRecipe, readSnapshot } from "@/lib/quantity";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
let db: PrismaClient;
let userId: string;

const contactInput = { firstName: "Arthur", lastName: "Morgan", missiveCode: "00451", activity: "Mandriano", city: "Valentine", notes: "" };

d("scenari del gestionale", () => {
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
  });
  afterAll(async () => db?.$disconnect());
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "Payment","OrderItem","Order","RecipeMaterial","Recipe","Category","Contact","Announcement","AuditLog","Session","User" RESTART IDENTITY CASCADE',
    );
    userId = (await db.user.create({ data: { username: "test", displayName: "Test", passwordHash: "x" } })).id;
  });

  it("Scenario 1 — contatto, ordine con due lavorazioni e acconto", async () => {
    const c = await createContact(db, contactInput, userId);
    expect(c.missiveCode).toBe("00451"); // zeri iniziali conservati
    const o = await createOrder(
      db,
      {
        contactMode: "existing",
        contactId: c.id,
        title: "Arredo per il ranch",
        status: "RICEVUTO",
        deposit: "20,00",
        items: [
          { description: "Tavolo", quantity: "1", unitPrice: "35,00" },
          { description: "Sedie", quantity: "4", unitPrice: "12,50" },
        ],
      },
      userId,
    );
    expect(o.number).toBe(1);
    expect(o.totalCents).toBe(8500);
    expect(o.paidCents).toBe(2000);
    expect(paymentState(o.totalCents, o.paidCents)).toBe("PARZIALE");
    const s = await getSummary(db, "totale");
    expect(s.toCollectCents).toBe(6500);
    expect(s.collectedCents).toBe(2000);
    expect(s.openValueCents).toBe(8500);
    const board = await db.order.findMany({ where: { archivedAt: null } });
    expect(board).toHaveLength(1);
  });

  it("Scenario 2 — secondo pagamento salda l'ordine; niente eccedenze", async () => {
    const o = await createOrder(
      db,
      { contactMode: "none", customerName: "Sadie Adler", title: "Porta", status: "IN_LAVORAZIONE", deposit: "10", items: [{ description: "Porta", quantity: "1", unitPrice: "30" }] },
      userId,
    );
    await expect(addPayment(db, o.id, { amount: "20,01" }, userId)).rejects.toThrow(/residuo/);
    const { order } = await addPayment(db, o.id, { amount: "20,00", note: "Saldo" }, userId);
    expect(order.totalCents - order.paidCents).toBe(0);
    expect(paymentState(order.totalCents, order.paidCents)).toBe("PAGATO");
    expect((await getSummary(db, "totale")).toCollectCents).toBe(0);
    expect((await getSummary(db, "totale")).inWorkCount).toBe(1);
  });

  it("correzione e annullamento dei pagamenti sono tracciati e ricalcolano il residuo", async () => {
    const o = await createOrder(db, { contactMode: "none", customerName: "John", title: "Sedia", status: "RICEVUTO", deposit: "5", items: [{ description: "Sedia", quantity: "1", unitPrice: "12" }] }, userId);
    const p = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
    await expect(editPayment(db, p.id, { amount: "13", reason: "errore" }, userId)).rejects.toThrow(/superereb/);
    const e = await editPayment(db, p.id, { amount: "6", reason: "importo errato" }, userId);
    expect(e.order.paidCents).toBe(600);
    const v = await voidPayment(db, p.id, { reason: "assegno scoperto" }, userId);
    expect(v.order.paidCents).toBe(0);
    expect(await db.payment.count()).toBe(1); // lo storico resta
    const logs = await db.auditLog.findMany({ where: { entity: "Payment" } });
    expect(logs.map((l) => l.action).sort()).toEqual(["correct", "void"]);
  });

  it("il totale non può scendere sotto quanto già incassato", async () => {
    const o = await createOrder(db, { contactMode: "none", customerName: "X", title: "T", status: "RICEVUTO", deposit: "30", items: [{ description: "A", quantity: "1", unitPrice: "30" }] }, userId);
    await expect(
      updateOrder(db, o.id, { contactMode: "none", customerName: "X", title: "T", status: "RICEVUTO", items: [{ description: "A", quantity: "1", unitPrice: "20" }] }, userId),
    ).rejects.toThrow(/superereb/);
  });

  it("gli annullati sono esclusi da 'da riscuotere' e dalle commesse aperte", async () => {
    await createOrder(db, { contactMode: "none", customerName: "X", title: "T", status: "ANNULLATO", items: [{ description: "A", quantity: "1", unitPrice: "50" }] }, userId);
    const s = await getSummary(db, "totale");
    expect(s.toCollectCents).toBe(0);
    expect(s.openValueCents).toBe(0);
  });

  it("Scenario 3 — ricetta collegata all'ordine, materiali calcolati e dati storici conservati", async () => {
    const r = await createRecipe(
      db,
      { name: "Tavolo", suggestedPrice: "35", materials: [{ name: "Assi di legno", quantity: "4", unit: "pz" }, { name: "Chiodi", quantity: "12", unit: "pz" }] },
      { kind: "keep" },
      userId,
    );
    const o = await createOrder(db, { contactMode: "none", customerName: "Dutch", title: "Tavoli", status: "RICEVUTO", items: [{ recipeId: r.id, description: "Tavolo", quantity: "5", unitPrice: "35" }] }, userId);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
    const snap = readSnapshot(item.materialsSnapshot)!;
    const mats = planRecipe(snap.materials, snap.yield, item.quantity).materials;
    expect(mats.find((m) => m.name === "Assi di legno")!.total).toBe("20");
    expect(mats.find((m) => m.name === "Chiodi")!.total).toBe("60");
    // modifica della ricetta: vale per il futuro, l'ordine storico non cambia
    await updateRecipe(db, r.id, { name: "Tavolo", suggestedPrice: "50", materials: [{ name: "Assi di legno", quantity: "6", unit: "pz" }] }, { kind: "keep" }, userId);
    const again = await db.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
    expect(again.unitPriceCents).toBe(3500);
    expect(readSnapshot(again.materialsSnapshot)!.materials[0].quantity).toBe("4");
  });

  it("Scenario 3b — ricetta base con resa: 2 assi producono 8 pezzi", async () => {
    const r = await createRecipe(
      db,
      { name: "Manici", yieldQuantity: "8", materials: [{ name: "Assi di pino", quantity: "2", unit: "pz" }] },
      { kind: "keep" },
      userId,
    );
    expect(r.yieldQuantity).toBe(8);
    const o = await createOrder(db, { contactMode: "none", customerName: "Arthur", title: "Manici", status: "RICEVUTO", items: [{ recipeId: r.id, description: "Manico", quantity: "20", unitPrice: "2" }] }, userId);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
    const snap = readSnapshot(item.materialsSnapshot)!;
    expect(snap.yield).toBe(8);
    // 20 pezzi → 3 esecuzioni → 6 assi
    expect(planRecipe(snap.materials, snap.yield, item.quantity).materials[0].total).toBe("6");
  });

  it("Scenario 4 — strillone con emoji salvato e modificato senza perdite", async () => {
    const content = "Cerchiamo assi 🪵🪚 — pagamento 💵 subito!\nSaluti 🤠🇮🇹 «accenti» àèìòù 👨‍👩‍👧";
    const a = await createAnnouncement(db, { title: "Avviso 📣", content, category: "RICERCA_MATERIALI", priority: "ALTA", status: "PUBBLICATO", pinned: true }, userId);
    expect((await db.announcement.findUniqueOrThrow({ where: { id: a.id } })).content).toBe(content);
    const edited = content + " ✅";
    await updateAnnouncement(db, a.id, { title: "Avviso 📣 aggiornato", content: edited, category: "AVVISO", priority: "NORMALE", status: "PUBBLICATO", pinned: false }, userId);
    const after = await db.announcement.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.content).toBe(edited);
    expect(after.title).toBe("Avviso 📣 aggiornato");
  });

  it("eliminare un contatto non cancella gli ordini storici", async () => {
    const c = await createContact(db, contactInput, userId);
    const o = await createOrder(db, { contactMode: "existing", contactId: c.id, title: "Carro", status: "CONSEGNATO", items: [{ description: "Ruota", quantity: "2", unitPrice: "8" }] }, userId);
    await deleteContact(db, c.id, userId);
    const kept = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(kept.contactId).toBeNull();
    expect(kept.customerName).toBe("Arthur Morgan");
    expect(kept.customerMissive).toBe("00451");
  });

  it("ordine da rubrica con campi 'nuovo contatto' vuoti e ordine con nuovo contatto", async () => {
    const c = await createContact(db, contactInput, userId);
    const empty = { firstName: "", lastName: "", missiveCode: "", activity: "", city: "", notes: "" };
    const o = await createOrder(db, { contactMode: "existing", contactId: c.id, newContact: empty, title: "T", status: "RICEVUTO", items: [{ description: "A", quantity: "1", unitPrice: "1" }] }, userId);
    expect(o.contactId).toBe(c.id);
    const o2 = await createOrder(db, { contactMode: "new", newContact: { ...empty, firstName: " Bill ", lastName: "Williamson", missiveCode: "007", activity: "Bandito" }, title: "T", status: "RICEVUTO", items: [{ description: "A", quantity: "1", unitPrice: "1" }] }, userId);
    expect(o2.customerName).toBe("Bill Williamson");
    expect(o2.customerMissive).toBe("007");
    await expect(createOrder(db, { contactMode: "new", newContact: empty, title: "T", status: "RICEVUTO", items: [{ description: "A", quantity: "1", unitPrice: "1" }] }, userId)).rejects.toThrow();
  });

  it("pagamenti concorrenti non superano il totale (lock di riga)", async () => {
    const o = await createOrder(db, { contactMode: "none", customerName: "X", title: "T", status: "RICEVUTO", items: [{ description: "A", quantity: "1", unitPrice: "10" }] }, userId);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => addPayment(db, o.id, { amount: "6" }, userId)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).paidCents).toBe(600);
  });

  it("Importazione contatti — codice senza spazi, doppioni accorpati", async () => {
    const c = await createContact(db, contactInput, userId);
    const r = await importContacts(
      db,
      {
        rows: [
          { fullName: "Arthur Morgan", missiveCode: "004 51", activity: "Pistolero" }, // stesso codice → accorpato
          { fullName: "John Marston", missiveCode: "CH 856", activity: "Allevatore" },
          { fullName: "Jack Marston", missiveCode: "CH856", activity: "Scrittore" }, // doppione nel lotto
          { fullName: "Arthur Morgan", missiveCode: "999", activity: "Omonimo" }, // stesso nome, codice diverso → nuovo
        ],
      },
      userId,
      "csv",
    );
    expect(r).toEqual({ created: 2, merged: 2 });
    const all = await db.contact.findMany({ orderBy: { createdAt: "asc" } });
    expect(all).toHaveLength(3);
    expect(all[0]).toMatchObject({ id: c.id, firstName: "Arthur", lastName: "Morgan", missiveCode: "00451", activity: "Pistolero", city: "Valentine" });
    expect(all[1]).toMatchObject({ firstName: "Jack", lastName: "Marston", missiveCode: "CH856", activity: "Scrittore" });
  });
});
