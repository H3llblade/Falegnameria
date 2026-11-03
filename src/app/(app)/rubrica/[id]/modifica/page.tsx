import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Modifica contatto" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <div>
      <PageHeader title="Modifica contatto" kicker={`${c.lastName} ${c.firstName}`} />
      <ContactForm
        id={c.id}
        initial={{ firstName: c.firstName, lastName: c.lastName, missiveCode: c.missiveCode, activity: c.activity, city: c.city ?? "", notes: c.notes ?? "" }}
      />
    </div>
  );
}
