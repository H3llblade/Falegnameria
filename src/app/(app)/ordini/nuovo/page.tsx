import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { orderFormOptions } from "@/lib/services/options";
import { OrderForm } from "@/components/orders/order-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Nuovo ordine" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ contatto?: string; ricetta?: string }> }) {
  await requirePageUser();
  const sp = await searchParams;
  const { contacts, recipes } = await orderFormOptions(prisma);
  const nextNumber = await prisma.$queryRaw<{ n: bigint }[]>`SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END AS n FROM "Order_number_seq"`;
  return (
    <div>
      <PageHeader title="Nuova commissione" kicker={`Prossimo numero previsto: N° ${String(nextNumber[0]?.n ?? 1).padStart(4, "0")} · data odierna automatica`} />
      <OrderForm contacts={contacts} recipes={recipes} presetContactId={sp.contatto} presetRecipeId={sp.ricetta} />
    </div>
  );
}
