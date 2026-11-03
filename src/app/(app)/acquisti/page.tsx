import Link from "next/link";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { getPurchaseProducts } from "@/lib/services/settings";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { PurchaseCalculator } from "@/components/purchases/purchase-calculator";

export const metadata = { title: "Acquisti" };

export default async function PurchasesPage() {
  const me = await requirePageUser();
  const products = await getPurchaseProducts(prisma);
  const edit =
    me.role === "ADMIN" ? (
      <Link href="/impostazioni#acquisti" className="btn btn-paper btn-sm">
        <Settings size={15} aria-hidden /> Modifica prodotti e prezzi
      </Link>
    ) : null;
  return (
    <div>
      <PageHeader title="Acquisti" kicker="Compenso per chi vende alla bottega">
        {edit}
      </PageHeader>
      {products.length === 0 ? (
        <EmptyState title="Nessun prodotto in elenco">L&apos;amministratore può aggiungere i prodotti acquistati in Impostazioni.</EmptyState>
      ) : (
        <PurchaseCalculator products={products} />
      )}
    </div>
  );
}
