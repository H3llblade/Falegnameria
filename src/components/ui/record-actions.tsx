"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, ArchiveRestore, Copy, Pencil, Printer, Trash2 } from "lucide-react";
import { archiveAnnouncementAction, deleteAnnouncementAction } from "@/app/actions/announcements";
import { archiveRecipeAction, deleteRecipeAction, duplicateRecipeAction } from "@/app/actions/recipes";
import { archiveContactAction, deleteContactAction } from "@/app/actions/contacts";
import type { ActionResult } from "@/lib/action-result";
import { useConfirm } from "./dialog";
import { useActionToast } from "./toast";

type Kind = "announcement" | "recipe" | "contact";

const ACTIONS: Record<
  Kind,
  {
    archive: (id: string, a: boolean) => Promise<ActionResult>;
    remove: (id: string) => Promise<ActionResult>;
    duplicate?: (id: string) => Promise<ActionResult<{ id: string }>>;
    base: string;
    noun: string;
    deleteBody: string;
  }
> = {
  announcement: {
    archive: archiveAnnouncementAction,
    remove: deleteAnnouncementAction,
    base: "/strilloni",
    noun: "lo strillone",
    deleteBody: "Il manifesto verrà rimosso definitivamente. In alternativa è possibile archiviarlo.",
  },
  recipe: {
    archive: archiveRecipeAction,
    remove: deleteRecipeAction,
    duplicate: duplicateRecipeAction,
    base: "/ricettario",
    noun: "la lavorazione",
    deleteBody: "La scheda verrà rimossa dal ricettario. Gli ordini che la utilizzano conservano descrizione, prezzi e materiali concordati.",
  },
  contact: {
    archive: archiveContactAction,
    remove: deleteContactAction,
    base: "/rubrica",
    noun: "il contatto",
    deleteBody: "La scheda verrà rimossa dalla rubrica. Gli ordini storici del cliente NON vengono cancellati: conservano nome e codice missiva.",
  },
};

export function RecordActions({
  kind,
  id,
  archived,
  editHref,
  afterDelete,
  print = true,
}: {
  kind: Kind;
  id: string;
  archived: boolean;
  editHref: string;
  afterDelete: string;
  print?: boolean;
}) {
  const router = useRouter();
  const toast = useActionToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const cfg = ACTIONS[kind];

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Link href={editHref} className="btn btn-brass btn-sm">
        <Pencil size={15} aria-hidden /> Modifica
      </Link>
      {cfg.duplicate && (
        <button
          type="button"
          className="btn btn-paper btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await cfg.duplicate!(id);
              toast(r);
              if (r.ok) router.push(`${cfg.base}/${r.data!.id}`);
            })
          }
        >
          <Copy size={15} aria-hidden /> Duplica
        </button>
      )}
      {print && (
        <button type="button" className="btn btn-paper btn-sm" onClick={() => window.print()}>
          <Printer size={15} aria-hidden /> Stampa
        </button>
      )}
      <button
        type="button"
        className="btn btn-paper btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            toast(await cfg.archive(id, !archived));
            router.refresh();
          })
        }
      >
        {archived ? <ArchiveRestore size={15} aria-hidden /> : <Archive size={15} aria-hidden />} {archived ? "Ripristina" : "Archivia"}
      </button>
      <button
        type="button"
        className="btn btn-bordeaux btn-sm"
        disabled={pending}
        onClick={async () => {
          const r = await confirm({ title: `Eliminare ${cfg.noun}?`, body: cfg.deleteBody, confirmLabel: "Elimina", danger: true });
          if (!r.confirmed) return;
          start(async () => {
            const res = await cfg.remove(id);
            if (toast(res)) {
              router.push(afterDelete);
              router.refresh();
            }
          });
        }}
      >
        <Trash2 size={15} aria-hidden /> Elimina
      </button>
    </div>
  );
}
