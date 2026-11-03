import { requirePageUser } from "@/lib/auth/session";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Nuovo strillone" };

export default async function NewAnnouncementPage() {
  await requirePageUser();
  return (
    <div>
      <PageHeader title="Nuovo strillone" kicker="Componi il manifesto" />
      <AnnouncementForm />
    </div>
  );
}
