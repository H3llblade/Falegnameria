/**
 * Dati DIMOSTRATIVI: si inseriscono solo con il comando esplicito `npm run seed:demo`.
 * Rifiuta l'esecuzione in produzione salvo ALLOW_DEMO_SEED=1.
 * Le ricette sono marcate "isDemo" e non rappresentano ricette ufficiali del server.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { DEFAULT_RECIPE_CATEGORIES } from "../src/lib/labels";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Seed dimostrativo bloccato in produzione (impostare ALLOW_DEMO_SEED=1 per forzare).");
  }
  for (const [i, name] of DEFAULT_RECIPE_CATEGORIES.entries()) {
    await prisma.category.upsert({ where: { kind_name: { kind: "RECIPE", name } }, update: {}, create: { name, kind: "RECIPE", sortOrder: i } });
  }
  const cat = async (name: string) => (await prisma.category.findUnique({ where: { kind_name: { kind: "RECIPE", name } } }))!.id;

  if ((await prisma.recipe.count({ where: { isDemo: true } })) === 0) {
    await prisma.recipe.create({
      data: {
        name: "Tavolo da saloon (esempio)",
        categoryId: await cat("Tavoli"),
        isDemo: true,
        description: "Scheda dimostrativa: tavolo robusto a quattro gambe per locande e saloon.",
        tools: "Sega a mano\nPialla\nMartello\nScalpello",
        procedure: "Tagliare le assi a misura\nPiallare il piano\nAssemblare le gambe con incastri\nInchiodare il piano\nOliare la superficie",
        timeMinutes: 90,
        materialCostCents: 1200,
        suggestedPriceCents: 3500,
        materials: {
          create: [
            { name: "Assi di legno", quantity: new Prisma.Decimal(4), unit: "pz", sortOrder: 0 },
            { name: "Chiodi", quantity: new Prisma.Decimal(24), unit: "pz", sortOrder: 1 },
            { name: "Olio di lino", quantity: new Prisma.Decimal("0.25"), unit: "l", sortOrder: 2 },
          ],
        },
      },
    });
    await prisma.recipe.create({
      data: {
        name: "Sedia impagliata (esempio)",
        categoryId: await cat("Sedie"),
        isDemo: true,
        description: "Scheda dimostrativa: sedia semplice con seduta in paglia intrecciata.",
        tools: "Sega a mano\nTrapano a manovella",
        procedure: "Preparare i montanti\nForare per i pioli\nAssemblare il telaio\nIntrecciare la seduta",
        timeMinutes: 45,
        materialCostCents: 400,
        suggestedPriceCents: 1200,
        materials: {
          create: [
            { name: "Assi di legno", quantity: new Prisma.Decimal(2), unit: "pz", sortOrder: 0 },
            { name: "Paglia", quantity: new Prisma.Decimal("1.5"), unit: "kg", sortOrder: 1 },
          ],
        },
      },
    });
  }
  if ((await prisma.announcement.count()) === 0) {
    await prisma.announcement.create({
      data: {
        title: "Si cercano assi di quercia 🪵",
        content: "La bottega acquista assi di quercia stagionata.\nPagamento in contanti alla consegna 💵\n\n(annuncio dimostrativo)",
        category: "RICERCA_MATERIALI",
        priority: "ALTA",
        status: "PUBBLICATO",
        pinned: true,
      },
    });
  }
  console.log("Dati dimostrativi inseriti (ricette marcate come esempio).");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
