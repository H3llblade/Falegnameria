"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { saveRecipeAction } from "@/app/actions/recipes";
import { recipeSchema, type RecipeInput } from "@/lib/validation/schemas";
import { applyServerErrors, FieldShell, Input, Select, Textarea } from "@/components/ui/form";
import { useActionToast } from "@/components/ui/toast";

const MAX_IMG = 2 * 1024 * 1024;
const IMG_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function RecipeForm({
  id,
  initial,
  categories,
  hasImage,
}: {
  id?: string;
  initial?: RecipeInput;
  categories: { id: string; name: string }[];
  hasImage?: boolean;
}) {
  const router = useRouter();
  const toast = useActionToast();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecipeInput>({
    resolver: zodResolver(recipeSchema),
    defaultValues: initial ?? {
      name: "",
      categoryId: "",
      description: "",
      tools: "",
      procedure: "",
      timeMinutes: "",
      yieldQuantity: "1",
      materialCost: "",
      suggestedPrice: "",
      notes: "",
      materials: [{ name: "", quantity: "1", unit: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "materials" });
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"keep" | "set" | "remove">("keep");
  const [imgError, setImgError] = useState<string | null>(null);

  const pickImage = (f: File | undefined) => {
    setImgError(null);
    if (!f) return;
    if (!IMG_TYPES.includes(f.type)) return setImgError("Formato non supportato: usare PNG, JPEG o WebP");
    if (f.size > MAX_IMG) return setImgError("Immagine troppo grande (massimo 2 MB)");
    if (preview) URL.revokeObjectURL(preview);
    setImage(f);
    setPreview(URL.createObjectURL(f));
    setImageMode("set");
  };

  const onSubmit = async (values: RecipeInput) => {
    const fd = new FormData();
    fd.set("data", JSON.stringify(values));
    fd.set("imageMode", imageMode);
    if (image && imageMode === "set") fd.set("image", image);
    const r = await saveRecipeAction(id ?? null, fd);
    toast(r);
    if (!r.ok) {
      applyServerErrors(r.fieldErrors, setError);
      return;
    }
    router.push(`/ricettario/${r.data!.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="paper paper-lined space-y-6 px-5 py-7 sm:px-10">
      <div className="grid gap-4 pl-8 sm:grid-cols-2">
        <FieldShell label="Nome lavorazione" htmlFor="r-name" required error={errors.name} className="sm:col-span-2">
          <Input id="r-name" invalid={!!errors.name} {...register("name")} />
        </FieldShell>
        <FieldShell label="Categoria" htmlFor="r-cat">
          <Select id="r-cat" {...register("categoryId")}>
            <option value="">— Senza categoria —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldShell>
        <FieldShell label="Tempo di lavorazione (minuti)" htmlFor="r-time" error={errors.timeMinutes}>
          <Input id="r-time" inputMode="numeric" className="num" {...register("timeMinutes")} />
        </FieldShell>
        <FieldShell label="Costo dei materiali ($)" htmlFor="r-cost" error={errors.materialCost} hint="Per una unità di prodotto">
          <Input id="r-cost" inputMode="decimal" className="num" placeholder="0,00" invalid={!!errors.materialCost} {...register("materialCost")} />
        </FieldShell>
        <FieldShell label="Prezzo di vendita suggerito ($)" htmlFor="r-price" error={errors.suggestedPrice} hint="Per una unità di prodotto">
          <Input id="r-price" inputMode="decimal" className="num" placeholder="0,00" invalid={!!errors.suggestedPrice} {...register("suggestedPrice")} />
        </FieldShell>
        <FieldShell label="Descrizione" htmlFor="r-desc" className="sm:col-span-2">
          <Textarea id="r-desc" rows={3} {...register("description")} />
        </FieldShell>
      </div>

      <fieldset className="pl-8">
        <legend className="font-display text-xl">Ricetta base</legend>
        <p className="font-fell italic text-ink-soft">
          Indicate i materiali di una singola esecuzione e quante unità di prodotto se ne ottengono (es. 2 assi di pino → 8 manici).
        </p>
        <FieldShell label="Unità prodotte con questa ricetta" htmlFor="r-yield" required error={errors.yieldQuantity} className="mt-3 max-w-xs">
          <Input id="r-yield" inputMode="numeric" className="num" invalid={!!errors.yieldQuantity} {...register("yieldQuantity")} />
        </FieldShell>
        <h3 className="mt-4 font-heading text-lg">Materiali necessari per una esecuzione</h3>
        <ul className="mt-2 space-y-2">
          {fields.map((f, i) => {
            const e = errors.materials?.[i];
            return (
              <li key={f.id} className="grid grid-cols-[1fr_6rem_6rem_auto] items-start gap-2 max-sm:grid-cols-[1fr_5rem] ">
                <div className="max-sm:col-span-2">
                  <label htmlFor={`m-n-${i}`} className="sr-only">
                    Materiale {i + 1}
                  </label>
                  <Input id={`m-n-${i}`} placeholder="Es. Assi di legno di pino" invalid={!!e?.name} {...register(`materials.${i}.name`)} />
                  {e?.name && <p className="font-fell text-sm italic text-bordeaux">{e.name.message}</p>}
                </div>
                <div>
                  <label htmlFor={`m-q-${i}`} className="sr-only">
                    Quantità
                  </label>
                  <Input id={`m-q-${i}`} inputMode="decimal" className="num" placeholder="Q.tà" invalid={!!e?.quantity} {...register(`materials.${i}.quantity`)} />
                  {e?.quantity && <p className="font-fell text-sm italic text-bordeaux">{e.quantity.message}</p>}
                </div>
                <div>
                  <label htmlFor={`m-u-${i}`} className="sr-only">
                    Unità
                  </label>
                  <Input id={`m-u-${i}`} placeholder="pz, kg…" {...register(`materials.${i}.unit`)} />
                </div>
                <button type="button" className="btn btn-ghost btn-sm text-bordeaux" onClick={() => remove(i)} aria-label={`Rimuovi materiale ${i + 1}`}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn-paper btn-sm mt-3" onClick={() => append({ name: "", quantity: "1", unit: "" })}>
          <Plus size={16} aria-hidden /> Aggiungi materiale
        </button>
      </fieldset>

      <div className="grid gap-4 pl-8">
        <FieldShell label="Strumenti necessari" htmlFor="r-tools" hint="Uno per riga">
          <Textarea id="r-tools" rows={3} {...register("tools")} />
        </FieldShell>
        <FieldShell label="Procedimento" htmlFor="r-proc" hint="Un passaggio per riga: verrà numerato automaticamente">
          <Textarea id="r-proc" rows={7} {...register("procedure")} />
        </FieldShell>
        <FieldShell label="Note" htmlFor="r-notes">
          <Textarea id="r-notes" rows={3} {...register("notes")} />
        </FieldShell>

        <div>
          <span className="field-label">Illustrazione (facoltativa)</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn btn-paper btn-sm cursor-pointer">
              <ImagePlus size={16} aria-hidden /> Scegli immagine
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            {(hasImage || image) && imageMode !== "remove" && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-bordeaux"
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                  setImageMode("remove");
                }}
              >
                Rimuovi immagine
              </button>
            )}
            <span className="font-fell text-sm italic text-ink-soft">PNG, JPEG o WebP, massimo 2 MB.</span>
          </div>
          {imgError && <p className="mt-1 font-fell italic text-bordeaux">{imgError}</p>}
          {preview ? (
            <img src={preview} alt="Anteprima" className="mt-3 max-h-56 border-4 border-parchment-light shadow" />
          ) : hasImage && imageMode === "keep" && id ? (
            <img src={`/api/ricette/${id}/immagine`} alt="Immagine attuale" className="mt-3 max-h-56 border-4 border-parchment-light shadow" />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pl-8">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Annulla
        </button>
        <button className="btn btn-ink" disabled={isSubmitting}>
          <Save size={17} aria-hidden /> {isSubmitting ? "Annotazione…" : id ? "Salva modifiche" : "Registra nel ricettario"}
        </button>
      </div>
    </form>
  );
}
