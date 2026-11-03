"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { parseMoneyToCents } from "@/lib/money";
import { setPurchaseProducts } from "@/lib/services/settings";
import { purchaseProductsSchema } from "@/lib/validation/schemas";

/** Solo l'amministratore stabilisce cosa acquista la bottega e a quale prezzo */
export async function setPurchaseProductsAction(raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    const d = purchaseProductsSchema.parse(raw);
    await setPurchaseProducts(
      prisma,
      d.products.map((p) => ({
        id: /^[\w-]{1,40}$/.test(p.id) ? p.id : randomBytes(6).toString("hex"),
        name: p.name,
        unit: p.unit,
        priceCents: parseMoneyToCents(p.price),
      })),
      me.id,
    );
    revalidatePath("/", "layout");
  }, "Prodotti acquistati aggiornati");
}
