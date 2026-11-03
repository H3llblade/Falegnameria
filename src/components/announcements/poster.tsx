import type { AnnouncementCategory, AnnouncementPriority } from "@prisma/client";
import { ANNOUNCEMENT_CATEGORY_LABEL, formatDate } from "@/lib/labels";
import { Flourish, Stamp } from "@/components/ui/bits";

export type PosterData = {
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  pinned: boolean;
  publishedAt: Date | string | null;
  expiresAt: Date | string | null;
  draft?: boolean;
  expired?: boolean;
};

/** Manifesto affisso: il contenuto è sempre reso come testo (nessun HTML) */
export function Poster({ a, compact }: { a: PosterData; compact?: boolean }) {
  return (
    <div className={`relative flex h-full flex-col text-center ${compact ? "px-5 pb-5 pt-7" : "px-6 pb-8 pt-10 sm:px-12"}`}>
      <p className="font-heading text-[0.8rem] tracking-[0.35em] text-bordeaux uppercase">{ANNOUNCEMENT_CATEGORY_LABEL[a.category]}</p>
      <div className="mx-auto my-1.5 h-[3px] w-2/3 border-y border-ink/70" aria-hidden />
      <h2 className={`font-display leading-[1.05] break-words ${compact ? "text-[1.55rem]" : "text-4xl sm:text-5xl"}`}>{a.title || "Titolo del manifesto"}</h2>
      <Flourish className="my-3 text-ink/70" />
      <p className={`user-text text-left ${compact ? "line-clamp-[8] text-[1rem]" : "drop-cap text-[1.15rem] leading-relaxed"}`}>
        {a.content || "Il testo dell'annuncio comparirà qui."}
      </p>
      <div className="mt-auto pt-4">
        <div className="mx-auto h-[3px] w-2/3 border-y border-ink/70" aria-hidden />
        <p className="mt-2 font-fell text-[0.92rem] italic text-ink-soft">
          Affisso il {formatDate(a.publishedAt ?? new Date())}
          {a.expiresAt ? ` · valido fino al ${formatDate(a.expiresAt)}` : ""}
        </p>
      </div>
      <div className="pointer-events-none absolute right-3 top-4 flex flex-col items-end gap-1">
        {a.priority === "URGENTE" && <Stamp tone="text-bordeaux">Urgente</Stamp>}
        {a.priority === "ALTA" && <Stamp tone="text-sepia">Importante</Stamp>}
        {a.draft && <Stamp tone="text-ink">Bozza</Stamp>}
        {a.expired && <Stamp tone="text-ink">Scaduto</Stamp>}
      </div>
    </div>
  );
}
