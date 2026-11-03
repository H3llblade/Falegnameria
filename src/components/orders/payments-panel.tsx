"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Coins, PencilLine } from "lucide-react";
import { addPaymentAction, editPaymentAction, voidPaymentAction } from "@/app/actions/orders";
import { paymentEditSchema, paymentSchema, type PaymentInput } from "@/lib/validation/schemas";
import { centsToInput, formatCents, safeParseMoney } from "@/lib/money";
import { formatDateShort, toDateInput } from "@/lib/labels";
import { applyServerErrors, FieldShell, Input } from "@/components/ui/form";
import { Modal, useConfirm } from "@/components/ui/dialog";
import { useActionToast } from "@/components/ui/toast";

export type PaymentRow = {
  id: string;
  amountCents: number;
  method: string | null;
  note: string | null;
  paidAt: string;
  createdBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export function PaymentsPanel({
  orderId,
  payments,
  residualCents,
  cancelled,
}: {
  orderId: string;
  payments: PaymentRow[];
  residualCents: number;
  cancelled: boolean;
}) {
  const router = useRouter();
  const toast = useActionToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<PaymentRow | null>(null);

  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: "", method: "", note: "", paidAt: toDateInput(new Date()) },
  });
  const amount = form.watch("amount");
  const amountCents = safeParseMoney(amount ?? "") ?? 0;

  const submit = async (v: PaymentInput) => {
    if (amountCents > residualCents) {
      form.setError("amount", { message: `Supera il residuo di ${formatCents(residualCents)}` });
      return;
    }
    const r = await addPaymentAction(orderId, v);
    if (!toast(r)) {
      if (!r.ok) applyServerErrors(r.fieldErrors, form.setError);
      return;
    }
    form.reset({ amount: "", method: "", note: "", paidAt: toDateInput(new Date()) });
    router.refresh();
  };

  const voidPayment = async (p: PaymentRow) => {
    const r = await confirm({
      title: "Annullare il pagamento?",
      body: (
        <p>
          Il pagamento di <strong className="num">{formatCents(p.amountCents)}</strong> del {formatDateShort(p.paidAt)} resterà nello storico,
          barrato, e non verrà più conteggiato negli incassi.
        </p>
      ),
      reasonLabel: "Motivo dell'annullamento",
      confirmLabel: "Annulla pagamento",
      danger: true,
    });
    if (!r.confirmed) return;
    toast(await voidPaymentAction(p.id, { reason: r.text }));
    router.refresh();
  };

  return (
    <section className="paper paper-lined px-5 py-5">
      <h2 className="pl-8 font-display text-lg">Registro pagamenti</h2>
      <ul className="mt-2 pl-8">
        {payments.length === 0 && <li className="py-2 font-fell italic text-ink-soft">Nessun pagamento registrato.</li>}
        {payments.map((p) => (
          <li key={p.id} className={`border-b border-ink/15 py-2 ${p.voidedAt ? "opacity-60" : ""}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="num text-sm">{formatDateShort(p.paidAt)}</span>
              <span className={`num ${p.voidedAt ? "line-through" : "text-olive"}`}>{formatCents(p.amountCents)}</span>
            </div>
            <p className="font-fell text-[0.95rem] italic text-ink-soft">
              {[p.note, p.method, p.createdBy && `reg. ${p.createdBy}`].filter(Boolean).join(" · ") || "—"}
            </p>
            {p.voidedAt ? (
              <p className="font-fell text-sm italic text-bordeaux">
                Annullato il {formatDateShort(p.voidedAt)}
                {p.voidedBy ? ` da ${p.voidedBy}` : ""}: {p.voidReason}
              </p>
            ) : (
              <div className="mt-1 flex gap-1">
                <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2 !py-0.5 text-sm" onClick={() => setEditing(p)}>
                  <PencilLine size={14} aria-hidden /> Correggi
                </button>
                <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2 !py-0.5 text-sm text-bordeaux" onClick={() => voidPayment(p)}>
                  <Ban size={14} aria-hidden /> Annulla
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 pl-8">
        <p className="flex justify-between font-heading">
          <span>Residuo dovuto</span>
          <span className={`num ${residualCents > 0 ? "text-bordeaux" : "text-olive"}`}>{formatCents(residualCents)}</span>
        </p>
        {cancelled ? (
          <p className="mt-2 font-fell italic text-ink-soft">Ordine annullato: non si registrano nuovi pagamenti.</p>
        ) : residualCents <= 0 ? (
          <p className="mt-2 font-fell italic text-olive">Commissione interamente saldata.</p>
        ) : (
          <form onSubmit={form.handleSubmit(submit)} noValidate className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <FieldShell label="Importo ($)" htmlFor="pay-amount" required error={form.formState.errors.amount}>
                <Input id="pay-amount" inputMode="decimal" className="num" placeholder="0,00" invalid={!!form.formState.errors.amount} {...form.register("amount")} />
              </FieldShell>
              <FieldShell label="Data" htmlFor="pay-date" error={form.formState.errors.paidAt}>
                <Input id="pay-date" type="date" {...form.register("paidAt")} />
              </FieldShell>
            </div>
            <button type="button" className="font-fell text-sm italic text-sepia underline decoration-dotted" onClick={() => form.setValue("amount", centsToInput(residualCents))}>
              Inserisci l&apos;intero residuo ({formatCents(residualCents)})
            </button>
            <FieldShell label="Modalità" htmlFor="pay-method">
              <Input id="pay-method" placeholder="Contanti, assegno, oro…" {...form.register("method")} />
            </FieldShell>
            <FieldShell label="Annotazione" htmlFor="pay-note">
              <Input id="pay-note" placeholder="Acconto, saldo…" {...form.register("note")} />
            </FieldShell>
            <button className="btn btn-olive w-full" disabled={form.formState.isSubmitting}>
              <Coins size={17} aria-hidden /> {form.formState.isSubmitting ? "Registrazione…" : "Registra pagamento"}
            </button>
          </form>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Correzione pagamento">
        {editing && <EditPaymentForm payment={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </section>
  );
}

function EditPaymentForm({ payment, onDone }: { payment: PaymentRow; onDone: () => void }) {
  const router = useRouter();
  const toast = useActionToast();
  const form = useForm({
    resolver: zodResolver(paymentEditSchema),
    defaultValues: {
      amount: centsToInput(payment.amountCents),
      method: payment.method ?? "",
      note: payment.note ?? "",
      paidAt: toDateInput(payment.paidAt),
      reason: "",
    },
  });
  const e = form.formState.errors;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={form.handleSubmit(async (v) => {
        const r = await editPaymentAction(payment.id, v);
        if (!toast(r)) {
          if (!r.ok) applyServerErrors(r.fieldErrors, form.setError);
          return;
        }
        router.refresh();
        onDone();
      })}
    >
      <p className="font-fell italic text-ink-soft">La correzione viene annotata nel registro di controllo con il valore precedente e il motivo.</p>
      <div className="grid grid-cols-2 gap-3">
        <FieldShell label="Importo ($)" htmlFor="ep-a" required error={e.amount}>
          <Input id="ep-a" className="num" inputMode="decimal" invalid={!!e.amount} {...form.register("amount")} />
        </FieldShell>
        <FieldShell label="Data" htmlFor="ep-d" error={e.paidAt}>
          <Input id="ep-d" type="date" {...form.register("paidAt")} />
        </FieldShell>
      </div>
      <FieldShell label="Modalità" htmlFor="ep-m">
        <Input id="ep-m" {...form.register("method")} />
      </FieldShell>
      <FieldShell label="Annotazione" htmlFor="ep-n">
        <Input id="ep-n" {...form.register("note")} />
      </FieldShell>
      <FieldShell label="Motivo della correzione" htmlFor="ep-r" required error={e.reason}>
        <Input id="ep-r" invalid={!!e.reason} {...form.register("reason")} />
      </FieldShell>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-paper" onClick={onDone}>
          Annulla
        </button>
        <button className="btn btn-ink" disabled={form.formState.isSubmitting}>
          Salva correzione
        </button>
      </div>
    </form>
  );
}
