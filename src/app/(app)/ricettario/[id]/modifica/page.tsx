import { requirePageUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { centsToInput } from "@/lib/money";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Modifica lavorazione" };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;
  const [r, categories] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id },
      select: {
        id: true, name: true, categoryId: true, description: true, tools: true, procedure: true, timeMinutes: true,
        materialCostCents: true, suggestedPriceCents: true, notes: true, imageMime: true,
        materials: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({ where: { kind: "RECIPE" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  if (!r) notFound();
  return (
    <div>
      <PageHeader title="Modifica lavorazione" kicker={r.name} />
      <p className="carved mb-4 font-fell italic">Le modifiche varranno per i prossimi ordini: le commissioni già registrate conservano i dati concordati.</p>
      <RecipeForm
        id={r.id}
        categories={categories}
        hasImage={!!r.imageMime}
        initial={{
          name: r.name,
          categoryId: r.categoryId ?? "",
          description: r.description,
          tools: r.tools,
          procedure: r.procedure,
          timeMinutes: r.timeMinutes ? String(r.timeMinutes) : "",
          materialCost: r.materialCostCents != null ? centsToInput(r.materialCostCents) : "",
          suggestedPrice: r.suggestedPriceCents != null ? centsToInput(r.suggestedPriceCents) : "",
          notes: r.notes ?? "",
          materials: r.materials.map((m) => ({ name: m.name, quantity: m.quantity.toString().replace(".", ","), unit: m.unit })),
        }}
      />
    </div>
  );
}
