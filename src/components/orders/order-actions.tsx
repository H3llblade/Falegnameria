"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { Archive, ArchiveRestore, Copy, FileDown, Pencil, Printer, Trash2 } from "lucide-react";
import { archiveOrderAction, deleteOrderAction, duplicateOrderAction, setOrderStatusAction } from "@/app/actions/orders";
import { ARCHIVABLE_STATUSES, ORDER_STATUS_LABEL, ORDER_STATUSES } from "@/lib/labels";
import { useConfirm } from "@/components/ui/dialog";
import { useActionToast } from "@/components/ui/toast";

export function OrderActions({ id, number, status, archived, isAdmin }: { id: string; number: number; status: OrderStatus; archived: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useActionToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const changeStatus = async (s: OrderStatus) => {
    if (s === status) return;
    if (s === "ANNULLATO") {
      const r = await confirm({
        title: "Annullare la commissione?",
        body: "L'ordine non verrà più conteggiato tra le somme da riscuotere. I pagamenti registrati restano nello storico.",
        confirmLabel: "Annulla ordine",
        danger: true,
      });
      if (!r.confirmed) return;
    }
    start(async () => {
      toast(await setOrderStatusAction(id, s));
      router.refresh();
    });
  };

  return (
    <section className="paper px-5 py-5">
      <h2 className="font-display text-lg">Stato della commessa</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => changeStatus(s)}
            aria-pressed={s === status}
            className={`btn btn-sm ${s === status ? (s === "ANNULLATO" ? "btn-bordeaux" : "btn-ink") : "btn-paper"}`}
          >
            {ORDER_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <hr className="rule my-4" aria-hidden />
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/ordini/${id}/modifica`} className="btn btn-paper btn-sm">
          <Pencil size={15} aria-hidden /> Modifica
        </Link>
        <button
          type="button"
          className="btn btn-paper btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await duplicateOrderAction(id);
              if (toast(r) && r.ok) router.push(`/ordini/${r.data!.id}`);
            })
          }
        >
          <Copy size={15} aria-hidden /> Duplica
        </button>
        <button type="button" className="btn btn-paper btn-sm" onClick={() => window.print()}>
          <Printer size={15} aria-hidden /> Stampa
        </button>
        <a href={`/api/ordini/${id}/pdf`} className="btn btn-paper btn-sm">
          <FileDown size={15} aria-hidden /> PDF
        </a>
        {(archived || ARCHIVABLE_STATUSES.includes(status)) && (
          <button
            type="button"
            className="btn btn-paper btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                toast(await archiveOrderAction(id, !archived));
                router.refresh();
              })
            }
          >
            {archived ? <ArchiveRestore size={15} aria-hidden /> : <Archive size={15} aria-hidden />} {archived ? "Ripristina" : "Archivia"}
          </button>
        )}
        {isAdmin && (archived || status === "ANNULLATO") && (
          <button
            type="button"
            className="btn btn-bordeaux btn-sm"
            disabled={pending}
            onClick={async () => {
              const r = await confirm({
                title: "Eliminazione definitiva",
                body: (
                  <>
                    <p>
                      Procedura amministrativa: l&apos;ordine e i suoi pagamenti verranno rimossi dal registro. Una copia completa resta nel
                      registro di controllo.
                    </p>
                    <p className="mt-2 font-heading text-bordeaux">L&apos;operazione non è reversibile dall&apos;interfaccia.</p>
                  </>
                ),
                typeToConfirm: `ELIMINA ${number}`,
                confirmLabel: "Elimina definitivamente",
                danger: true,
              });
              if (!r.confirmed) return;
              start(async () => {
                const res = await deleteOrderAction(id, r.text);
                if (toast(res)) router.push("/ordini");
              });
            }}
          >
            <Trash2 size={15} aria-hidden /> Elimina
          </button>
        )}
      </div>
      {!archived && !ARCHIVABLE_STATUSES.includes(status) && (
        <p className="mt-3 font-fell text-sm italic text-ink-soft">L&apos;archiviazione è disponibile per ordini consegnati o annullati.</p>
      )}
    </section>
  );
}
