import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Nuovo contatto" };

export default function NewContactPage() {
  return (
    <div>
      <PageHeader title="Nuovo contatto" kicker="Annotazione in rubrica" />
      <ContactForm />
    </div>
  );
}
