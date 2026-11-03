"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { checkDuplicatesAction, createContactAction, updateContactAction } from "@/app/actions/contacts";
import { contactSchema, type ContactInput } from "@/lib/validation/schemas";
import type { DupMatch } from "@/lib/contacts";
import { applyServerErrors, FieldShell, Input, Textarea } from "@/components/ui/form";
import { useActionToast } from "@/components/ui/toast";

export function ContactForm({ id, initial }: { id?: string; initial?: ContactInput }) {
  const router = useRouter();
  const toast = useActionToast();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: initial ?? { name: "", missiveCode: "", activity: "", city: "", notes: "" },
  });
  const [name, missiveCode] = useWatch({ control, name: ["name", "missiveCode"] });
  const [dups, setDups] = useState<DupMatch[]>([]);
  const [ackDup, setAckDup] = useState(false);

  // Controllo duplicati mentre si scrive
  useEffect(() => {
    if (!missiveCode && !name) {
      setDups([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await checkDuplicatesAction([{ name: name ?? "", missiveCode: missiveCode ?? "" }], id);
      if (r.ok) setDups(r.data?.[0] ?? []);
    }, 400);
    return () => clearTimeout(t);
  }, [name, missiveCode, id]);

  const onSubmit = async (v: ContactInput) => {
    if (dups.length > 0 && !ackDup) {
      toast({ ok: false, error: "Possibile duplicato: confermare la casella sotto l'avviso per salvare comunque." });
      return;
    }
    const r = id ? await updateContactAction(id, v) : await createContactAction(v);
    toast(r);
    if (!r.ok) {
      applyServerErrors(r.fieldErrors, setError);
      return;
    }
    router.push(`/rubrica/${r.data!.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="paper frame mx-auto max-w-2xl space-y-4 px-6 py-7 sm:px-10">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldShell label="Nome e cognome" htmlFor="c-name" required error={errors.name} className="sm:col-span-2">
          <Input id="c-name" autoComplete="off" invalid={!!errors.name} {...register("name")} />
        </FieldShell>
        <FieldShell label="Codice missiva" htmlFor="c-code" required error={errors.missiveCode} hint="Senza spazi, zeri iniziali compresi">
          <Input id="c-code" className="num" autoComplete="off" invalid={!!errors.missiveCode} {...register("missiveCode")} />
        </FieldShell>
        <FieldShell label="Città" htmlFor="c-city" error={errors.city}>
          <Input id="c-city" {...register("city")} />
        </FieldShell>
        <FieldShell label="Descrizione attività" htmlFor="c-act" error={errors.activity} className="sm:col-span-2">
          <Input id="c-act" placeholder="Es. Allevatore di cavalli a Strawberry" invalid={!!errors.activity} {...register("activity")} />
        </FieldShell>
        <FieldShell label="Note" htmlFor="c-notes" className="sm:col-span-2">
          <Textarea id="c-notes" rows={3} {...register("notes")} />
        </FieldShell>
      </div>

      {dups.length > 0 && (
        <div className="border-l-4 border-bordeaux bg-bordeaux/10 px-4 py-3" role="alert">
          <p className="font-heading text-bordeaux">Possibile duplicato in rubrica</p>
          <ul className="mt-1 text-[0.98rem]">
            {dups.map((d) => (
              <li key={d.id}>
                <Link href={`/rubrica/${d.id}`} className="underline" target="_blank">
                  {d.label}
                </Link>{" "}
                — stesso {d.reason === "codice" ? "codice missiva" : "nome e cognome"}
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[#722F32]" checked={ackDup} onChange={(e) => setAckDup(e.target.checked)} />
            <span>Si tratta di una persona diversa: salva comunque</span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Annulla
        </button>
        <button className="btn btn-ink" disabled={isSubmitting}>
          <Save size={17} aria-hidden /> {isSubmitting ? "Registrazione…" : id ? "Salva modifiche" : "Registra contatto"}
        </button>
      </div>
    </form>
  );
}
