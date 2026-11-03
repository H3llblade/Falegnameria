import type { PrismaClient } from "@prisma/client";
import { sortContacts } from "@/lib/contacts";
import type { ContactOption, RecipeOption } from "@/components/orders/order-form";

export async function orderFormOptions(db: PrismaClient): Promise<{ contacts: ContactOption[]; recipes: RecipeOption[] }> {
  const [contacts, recipes] = await Promise.all([
    db.contact.findMany({
      where: { archivedAt: null },
      select: { id: true, firstName: true, lastName: true, missiveCode: true, activity: true },
    }),
    db.recipe.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      include: { category: true, materials: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);
  return {
    contacts: sortContacts(contacts),
    recipes: recipes.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category?.name ?? null,
      suggestedPriceCents: r.suggestedPriceCents,
      materials: r.materials.map((m) => ({ name: m.name, quantity: m.quantity.toString(), unit: m.unit })),
    })),
  };
}
