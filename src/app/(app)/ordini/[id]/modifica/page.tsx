import { requirePageUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { centsToInput } from "@/lib/money";
import { orderNumber, toDateInput } from "@/lib/labels";
import { orderFormOptions } from "@/lib/services/options";
import { OrderForm } from "@/components/orders/order-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Modifica ordine" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!order) notFound();
  const { contacts, recipes } = await orderFormOptions(prisma);
  // Le ricette archiviate già usate restano selezionabili per questo ordine
  const missing = order.items.filter((i) => i.recipeId && !recipes.some((r) => r.id === i.recipeId)).map((i) => i.recipeId!);
  if (missing.length) {
    const extra = await prisma.recipe.findMany({ where: { id: { in: missing } }, include: { category: true, materials: true } });
    recipes.push(
      ...extra.map((r) => ({
        id: r.id,
        name: `${r.name} (archiviata)`,
        category: r.category?.name ?? null,
        suggestedPriceCents: r.suggestedPriceCents,
        materials: r.materials.map((m) => ({ name: m.name, quantity: m.quantity.toString(), unit: m.unit })),
      })),
    );
  }
  const contactKnown = order.contactId && contacts.some((c) => c.id === order.contactId);
  return (
    <div>
      <PageHeader title={`Modifica ${orderNumber(order.number)}`} kicker={order.customerName} />
      <OrderForm
        orderId={order.id}
        contacts={contacts}
        recipes={recipes}
        initial={{
          contactMode: contactKnown ? "existing" : "none",
          contactId: contactKnown ? order.contactId! : "",
          newContact: { firstName: "", lastName: "", missiveCode: "", activity: "", city: "", notes: "" },
          customerName: order.customerName,
          customerMissive: order.customerMissive,
          title: order.title,
          description: order.description,
          dueDate: toDateInput(order.dueDate),
          notes: order.notes ?? "",
          status: order.status,
          deposit: "",
          depositMethod: "",
          items: order.items.map((i) => ({
            id: i.id,
            recipeId: i.recipeId ?? "",
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: centsToInput(i.unitPriceCents),
          })),
        }}
      />
    </div>
  );
}
