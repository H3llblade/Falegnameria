import { requirePageUser } from "@/lib/auth/session";
import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Nuovo contatto" };

export default async function NewContactPage() {
  await requirePageUser();
  return (
    <div>
      <PageHeader title="Nuovo contatto" kicker="Annotazione in rubrica" />
      <ContactForm />
    </div>
  );
}
