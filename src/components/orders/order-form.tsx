"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Plus, Save, Trash2 } from "lucide-react";
import { createOrderAction, updateOrderAction } from "@/app/actions/orders";
import { orderSchema, type OrderInput } from "@/lib/validation/schemas";
import { ORDER_STATUS_LABEL, ORDER_STATUSES } from "@/lib/labels";
import { centsToInput, formatCents, safeParseMoney } from "@/lib/money";
import { scaleMaterials, sumMaterials } from "@/lib/quantity";
import { applyServerErrors, FieldShell, Input, Select, Textarea } from "@/components/ui/form";
import { useActionToast } from "@/components/ui/toast";
import { Flourish } from "@/components/ui/bits";

export type ContactOption = { id: string; firstName: string; lastName: string; missiveCode: string; activity: string };
export type RecipeOption = {
  id: string;
  name: string;
  category: string | null;
  suggestedPriceCents: number | null;
  materials: { name: string; quantity: string; unit: string }[];
};

const DRAFT_KEY = "falegnameria:bozza-ordine";

const emptyItem = { recipeId: "", description: "", quantity: "1", unitPrice: "" };

export function OrderForm({
  contacts,
  recipes,
  initial,
  orderId,
  presetContactId,
  presetRecipeId,
}: {
  contacts: ContactOption[];
  recipes: RecipeOption[];
  initial?: OrderInput;
  orderId?: string;
  presetContactId?: string;
  presetRecipeId?: string;
}) {
  const router = useRouter();
  const toast = useActionToast();
  const isEdit = !!orderId;
  const presetRecipe = recipes.find((r) => r.id === presetRecipeId);

  const defaults: OrderInput = initial ?? {
    contactMode: contacts.length ? "existing" : "new",
    contactId: presetContactId ?? "",
    newContact: { firstName: "", lastName: "", missiveCode: "", activity: "", city: "", notes: "" },
    customerName: "",
    customerMissive: "",
    title: presetRecipe?.name ?? "",
    description: "",
    dueDate: "",
    notes: "",
    status: "RICEVUTO",
    deposit: "",
    depositMethod: "",
    items: [
      presetRecipe
        ? { recipeId: presetRecipe.id, description: presetRecipe.name, quantity: "1", unitPrice: centsToInput(presetRecipe.suggestedPriceCents) }
        : emptyItem,
    ],
  };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrderInput>({ resolver: zodResolver(orderSchema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const contactMode = useWatch({ control, name: "contactMode" });
  const contactId = useWatch({ control, name: "contactId" });
  const deposit = useWatch({ control, name: "deposit" });

  // ---- Bozza automatica (solo nuovi ordini, nel browser) ----
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    if (isEdit || presetContactId || presetRecipeId) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        reset(JSON.parse(raw));
        setDraftRestored(true);
      }
    } catch {
      /* bozza non leggibile: ignorata */
    }
  }, [isEdit, presetContactId, presetRecipeId, reset]);
  const all = useWatch({ control });
  useEffect(() => {
    if (isEdit || !isDirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()));
      } catch {
        /* spazio esaurito */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [all, isEdit, isDirty, getValues]);

  // ---- Calcoli ----
  const lines = (items ?? []).map((it) => {
    const qty = /^\d+$/.test(it?.quantity ?? "") ? Number(it!.quantity) : 0;
    const price = safeParseMoney(it?.unitPrice ?? "") ?? 0;
    return qty * price;
  });
  const total = lines.reduce((a, b) => a + b, 0);
  const depositCents = deposit ? (safeParseMoney(deposit) ?? 0) : 0;

  const materials = useMemo(() => {
    const lists = (items ?? []).flatMap((it) => {
      const r = recipes.find((x) => x.id === it?.recipeId);
      const qty = /^\d+$/.test(it?.quantity ?? "") ? Number(it!.quantity) : 0;
      if (!r || r.materials.length === 0 || qty <= 0) return [];
      try {
        return [scaleMaterials(r.materials, qty)];
      } catch {
        return [];
      }
    });
    return sumMaterials(lists);
  }, [items, recipes]);

  const [contactFilter, setContactFilter] = useState("");
  const filteredContacts = useMemo(() => {
    const f = contactFilter.trim().toLowerCase();
    if (!f) return contacts;
    return contacts.filter((c) => `${c.lastName} ${c.firstName} ${c.missiveCode} ${c.activity}`.toLowerCase().includes(f));
  }, [contacts, contactFilter]);
  const selectedContact = contacts.find((c) => c.id === contactId);

  const onRecipe = (index: number, recipeId: string) => {
    const r = recipes.find((x) => x.id === recipeId);
    if (!r) return;
    const cur = getValues(`items.${index}`);
    if (!cur.description || recipes.some((x) => x.name === cur.description)) setValue(`items.${index}.description`, r.name, { shouldDirty: true });
    if (!cur.unitPrice && r.suggestedPriceCents) setValue(`items.${index}.unitPrice`, centsToInput(r.suggestedPriceCents), { shouldDirty: true });
    if (!getValues("title")) setValue("title", r.name, { shouldDirty: true });
  };

  const onSubmit = async (values: OrderInput) => {
    if (!isEdit && depositCents > total) {
      setError("deposit", { message: "L'acconto non può superare il totale" });
      return;
    }
    const res = isEdit ? await updateOrderAction(orderId!, values) : await createOrderAction(values);
    toast(res);
    if (!res.ok) {
      applyServerErrors(res.fieldErrors, setError);
      return;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    router.push(`/ordini/${res.data!.id}`);
    router.refresh();
  };

  const err = (path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as { message?: string } | undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast({ ok: false, error: "Controllare i campi evidenziati in rosso" }))} noValidate className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {draftRestored && (
          <div className="paper flex flex-wrap items-center justify-between gap-3 border-l-4 border-brass px-4 py-3" role="status">
            <p className="font-fell italic">È stata ripristinata la bozza non salvata del precedente ordine.</p>
            <button
              type="button"
              className="btn btn-paper btn-sm"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                reset(defaults);
                setDraftRestored(false);
              }}
            >
              Scarta bozza
            </button>
          </div>
        )}

        {/* ---------------- Cliente ---------------- */}
        <fieldset className="paper px-5 py-5 sm:px-6">
          <legend className="sr-only">Cliente</legend>
          <h2 className="font-display text-xl">Il cliente</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Origine del cliente">
            {(
              [
                ["existing", "Dalla rubrica"],
                ["new", "Nuovo contatto"],
                ["none", "Senza scheda"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className={`btn btn-sm cursor-pointer ${contactMode === v ? "btn-ink" : "btn-paper"}`}>
                <input type="radio" value={v} className="sr-only" {...register("contactMode")} />
                {l}
              </label>
            ))}
          </div>

          {contactMode === "existing" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FieldShell label="Filtra la rubrica" htmlFor="cfilter">
                <Input id="cfilter" placeholder="Cognome, codice, attività…" value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} />
              </FieldShell>
              <FieldShell label="Contatto" htmlFor="contactId" required error={errors.contactId}>
                <Select id="contactId" invalid={!!errors.contactId} {...register("contactId")}>
                  <option value="">— Selezionare —</option>
                  {filteredContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} · {c.missiveCode}
                    </option>
                  ))}
                  {selectedContact && !filteredContacts.includes(selectedContact) && (
                    <option value={selectedContact.id}>
                      {selectedContact.lastName} {selectedContact.firstName} · {selectedContact.missiveCode}
                    </option>
                  )}
                </Select>
              </FieldShell>
              {selectedContact && (
                <p className="font-fell italic text-ink-soft sm:col-span-2">
                  {selectedContact.activity} — codice missiva <span className="num not-italic">{selectedContact.missiveCode}</span>
                </p>
              )}
            </div>
          )}

          {contactMode === "new" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FieldShell label="Nome" htmlFor="nc-fn" required error={err("newContact.firstName")}>
                <Input id="nc-fn" invalid={!!err("newContact.firstName")} {...register("newContact.firstName")} />
              </FieldShell>
              <FieldShell label="Cognome" htmlFor="nc-ln" required error={err("newContact.lastName")}>
                <Input id="nc-ln" invalid={!!err("newContact.lastName")} {...register("newContact.lastName")} />
              </FieldShell>
              <FieldShell label="Codice missiva" htmlFor="nc-code" required error={err("newContact.missiveCode")}>
                <Input id="nc-code" className="num" invalid={!!err("newContact.missiveCode")} {...register("newContact.missiveCode")} />
              </FieldShell>
              <FieldShell label="Descrizione attività" htmlFor="nc-act" required error={err("newContact.activity")}>
                <Input id="nc-act" invalid={!!err("newContact.activity")} {...register("newContact.activity")} />
              </FieldShell>
              <FieldShell label="Città" htmlFor="nc-city">
                <Input id="nc-city" {...register("newContact.city")} />
              </FieldShell>
              <p className="self-end font-fell text-sm italic text-ink-soft">Il contatto verrà aggiunto alla rubrica insieme all&apos;ordine.</p>
            </div>
          )}

          {contactMode === "none" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FieldShell label="Nome e cognome cliente" htmlFor="cn" required error={errors.customerName}>
                <Input id="cn" invalid={!!errors.customerName} {...register("customerName")} />
              </FieldShell>
              <FieldShell label="Codice missiva cliente" htmlFor="cm" error={errors.customerMissive}>
                <Input id="cm" className="num" {...register("customerMissive")} />
              </FieldShell>
            </div>
          )}
        </fieldset>

        {/* ---------------- Commissione ---------------- */}
        <fieldset className="paper px-5 py-5 sm:px-6">
          <legend className="sr-only">Commissione</legend>
          <h2 className="font-display text-xl">La commissione</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FieldShell label="Oggetto della commissione" htmlFor="title" required error={errors.title} className="sm:col-span-2">
              <Input id="title" invalid={!!errors.title} placeholder="Es. Tavolo da saloon con quattro sedie" {...register("title")} />
            </FieldShell>
            <FieldShell label="Descrizione della lavorazione" htmlFor="description" error={errors.description} className="sm:col-span-2">
              <Textarea id="description" rows={3} {...register("description")} />
            </FieldShell>
            <FieldShell label="Consegna prevista" htmlFor="dueDate" error={errors.dueDate}>
              <Input id="dueDate" type="date" {...register("dueDate")} />
            </FieldShell>
            <FieldShell label="Stato dell'ordine" htmlFor="status">
              <Select id="status" {...register("status")}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </FieldShell>
          </div>
        </fieldset>

        {/* ---------------- Articoli ---------------- */}
        <fieldset className="paper paper-lined px-5 py-5 sm:px-6">
          <legend className="sr-only">Articoli e lavorazioni</legend>
          <div className="flex flex-wrap items-baseline justify-between gap-2 pl-8">
            <h2 className="font-display text-xl">Articoli e lavorazioni</h2>
            {errors.items?.message && <p className="font-fell italic text-bordeaux">{errors.items.message}</p>}
          </div>
          <ol className="mt-3 space-y-4 pl-8">
            {fields.map((f, i) => {
              const ie = errors.items?.[i];
              return (
                <li key={f.id} className="rounded-[2px] border border-ink/25 bg-parchment-light/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-heading text-ink-soft">Riga {i + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm text-bordeaux" onClick={() => remove(i)} aria-label={`Rimuovi riga ${i + 1}`}>
                        <Trash2 size={15} aria-hidden /> Rimuovi
                      </button>
                    )}
                  </div>
                  <input type="hidden" {...register(`items.${i}.id`)} />
                  <div className="grid gap-3 sm:grid-cols-6">
                    <FieldShell label="Dal ricettario" htmlFor={`it-r-${i}`} className="sm:col-span-6">
                      <Select id={`it-r-${i}`} {...register(`items.${i}.recipeId`, { onChange: (e) => onRecipe(i, e.target.value) })}>
                        <option value="">— Lavorazione libera —</option>
                        {recipes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.category ? `${r.category} · ` : ""}
                            {r.name}
                            {r.suggestedPriceCents ? ` (${formatCents(r.suggestedPriceCents)})` : ""}
                          </option>
                        ))}
                      </Select>
                    </FieldShell>
                    <FieldShell label="Descrizione" htmlFor={`it-d-${i}`} required error={ie?.description} className="sm:col-span-6">
                      <Input id={`it-d-${i}`} invalid={!!ie?.description} {...register(`items.${i}.description`)} />
                    </FieldShell>
                    <FieldShell label="Quantità" htmlFor={`it-q-${i}`} required error={ie?.quantity} className="sm:col-span-2">
                      <Input id={`it-q-${i}`} inputMode="numeric" className="num" invalid={!!ie?.quantity} {...register(`items.${i}.quantity`)} />
                    </FieldShell>
                    <FieldShell label="Prezzo unitario ($)" htmlFor={`it-p-${i}`} required error={ie?.unitPrice} className="sm:col-span-2">
                      <Input id={`it-p-${i}`} inputMode="decimal" className="num" placeholder="0,00" invalid={!!ie?.unitPrice} {...register(`items.${i}.unitPrice`)} />
                    </FieldShell>
                    <div className="sm:col-span-2">
                      <span className="field-label">Importo riga</span>
                      <p className="num flex min-h-[2.6rem] items-center justify-end border-b-2 border-ink/50 text-lg">{formatCents(lines[i] ?? 0)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 pl-8">
            <button type="button" className="btn btn-paper btn-sm" onClick={() => append(emptyItem)}>
              <Plus size={16} aria-hidden /> Aggiungi articolo
            </button>
          </div>
        </fieldset>

        <fieldset className="paper px-5 py-5 sm:px-6">
          <legend className="sr-only">Note</legend>
          <FieldShell label="Note" htmlFor="notes" error={errors.notes}>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </FieldShell>
        </fieldset>
      </div>

      {/* ---------------- Riepilogo ---------------- */}
      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <div className="paper frame px-5 py-6">
          <h2 className="text-center font-display text-xl">Conto</h2>
          <Flourish className="my-2 text-sepia" />
          <dl className="space-y-2 text-[1.05rem]">
            <div className="flex justify-between gap-3">
              <dt className="font-heading">Importo totale</dt>
              <dd className="num">{formatCents(total)}</dd>
            </div>
            {!isEdit && (
              <>
                <FieldShell label="Acconto versato ($)" htmlFor="deposit" error={errors.deposit} hint="Facoltativo: verrà registrato come primo pagamento">
                  <Input id="deposit" inputMode="decimal" className="num" placeholder="0,00" invalid={!!errors.deposit} {...register("deposit")} />
                </FieldShell>
                <FieldShell label="Modalità acconto" htmlFor="depositMethod">
                  <Input id="depositMethod" placeholder="Contanti, assegno…" {...register("depositMethod")} />
                </FieldShell>
              </>
            )}
            <div className="flex justify-between gap-3 border-t-2 border-double border-ink/60 pt-2">
              <dt className="font-heading">Importo residuo</dt>
              <dd className={`num ${total - depositCents < 0 ? "text-bordeaux" : ""}`}>{formatCents(total - (isEdit ? 0 : depositCents))}</dd>
            </div>
            {isEdit && <p className="font-fell text-sm italic text-ink-soft">Gli incassi si gestiscono dal registro pagamenti dell&apos;ordine.</p>}
          </dl>
          <button className="btn btn-ink mt-5 w-full" disabled={isSubmitting}>
            <Save size={17} aria-hidden /> {isSubmitting ? "Registrazione…" : isEdit ? "Salva modifiche" : "Registra commissione"}
          </button>
          <button type="button" className="btn btn-ghost mt-2 w-full" onClick={() => router.back()}>
            Annulla
          </button>
        </div>

        <div className="paper px-5 py-5">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <BookOpen size={18} aria-hidden /> Materiali necessari
          </h2>
          {materials.length === 0 ? (
            <p className="mt-2 font-fell italic text-ink-soft">Scegliere una lavorazione dal ricettario per calcolare i materiali.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink/15">
              {materials.map((m) => (
                <li key={m.name + m.unit} className="flex justify-between gap-3 py-1">
                  <span>{m.name}</span>
                  <span className="num whitespace-nowrap">
                    {m.total} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </form>
  );
}
