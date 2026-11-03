import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Nuovo strillone" };

export default function NewAnnouncementPage() {
  return (
    <div>
      <PageHeader title="Nuovo strillone" kicker="Componi il manifesto" />
      <AnnouncementForm />
    </div>
  );
}
