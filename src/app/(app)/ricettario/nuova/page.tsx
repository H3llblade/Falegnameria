import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Nuova lavorazione" };

export default async function NewRecipePage() {
  await requirePageUser();
  const categories = await prisma.category.findMany({ where: { kind: "RECIPE" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="Nuova lavorazione" kicker="Annotazione nel ricettario" />
      <RecipeForm categories={categories} />
    </div>
  );
}
