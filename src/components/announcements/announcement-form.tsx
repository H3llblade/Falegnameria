"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Smile } from "lucide-react";
import type { AnnouncementCategory, AnnouncementPriority } from "@prisma/client";
import { saveAnnouncementAction } from "@/app/actions/announcements";
import { announcementSchema, type AnnouncementInput } from "@/lib/validation/schemas";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_LABEL,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_PRIORITY_LABEL,
  toDateInput,
} from "@/lib/labels";
import { applyServerErrors, FieldShell, Input, Select, Textarea } from "@/components/ui/form";
import { useActionToast } from "@/components/ui/toast";
import { Poster } from "./poster";

const DRAFT_KEY = "falegnameria:bozza-strillone";

const EMOJI = [
  "🪵", "🪚", "🔨", "🪓", "🪑", "🚪", "🪟", "🛞", "🐎", "🤠", "🌵", "🏜️", "⛰️", "🌲", "🔥", "⭐",
  "📜", "📣", "📢", "✉️", "📦", "💰", "💵", "🪙", "⚖️", "🗓️", "⏰", "✅", "❌", "⚠️", "❗", "🔔",
  "👉", "👍", "🙏", "🤝", "😀", "😉", "😎", "❤️", "🍺", "🥃", "🎉", "🛠️", "⚙️", "🔩", "🧰", "🏠",
];

export function AnnouncementForm({ id, initial }: { id?: string; initial?: AnnouncementInput }) {
  const router = useRouter();
  const toast = useActionToast();
  const defaults: AnnouncementInput = initial ?? {
    title: "",
    content: "",
    category: "AVVISO",
    priority: "NORMALE",
    pinned: false,
    status: "PUBBLICATO",
    publishedAt: toDateInput(new Date()),
    expiresAt: "",
  };
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AnnouncementInput>({ resolver: zodResolver(announcementSchema), defaultValues: defaults });
  const v = useWatch({ control });
  const [picker, setPicker] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const { ref: contentRegRef, ...contentReg } = register("content");

  // Bozza automatica nel browser (solo per nuovi strilloni)
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (id) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        reset(JSON.parse(raw));
        setRestored(true);
      }
    } catch {}
  }, [id, reset]);
  useEffect(() => {
    if (id || !isDirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()));
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [v, id, isDirty, getValues]);

  const insertEmoji = (e: string) => {
    const el = contentRef.current;
    const cur = getValues("content") ?? "";
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    setValue("content", cur.slice(0, start) + e + cur.slice(end), { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + e.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const onSubmit = async (values: AnnouncementInput) => {
    const r = await saveAnnouncementAction(id ?? null, values);
    toast(r);
    if (!r.ok) {
      applyServerErrors(r.fieldErrors, setError);
      return;
    }
    try {
      if (!id) localStorage.removeItem(DRAFT_KEY);
    } catch {}
    router.push(`/strilloni/${r.data!.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-8 lg:grid-cols-2">
      <div className="paper space-y-4 px-5 py-6 sm:px-6">
        {restored && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-brass bg-brass/10 px-3 py-2" role="status">
            <span className="font-fell italic">Bozza precedente ripristinata.</span>
            <button
              type="button"
              className="btn btn-paper btn-sm"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                reset(defaults);
                setRestored(false);
              }}
            >
              Scarta
            </button>
          </div>
        )}
        <FieldShell label="Titolo" htmlFor="a-title" required error={errors.title}>
          <Input id="a-title" invalid={!!errors.title} maxLength={160} {...register("title")} />
        </FieldShell>
        <FieldShell label="Contenuto" htmlFor="a-content" required error={errors.content} hint="Testo semplice: emoji e a capo sono conservati, l'HTML non viene interpretato.">
          <div className="relative">
            <Textarea
              id="a-content"
              rows={9}
              invalid={!!errors.content}
              {...contentReg}
              ref={(el) => {
                contentRegRef(el);
                contentRef.current = el;
              }}
            />
            <button
              type="button"
              className="btn btn-paper btn-sm absolute bottom-2 right-2"
              onClick={() => setPicker((p) => !p)}
              aria-expanded={picker}
              aria-controls="emoji-picker"
            >
              <Smile size={16} aria-hidden /> Emoji
            </button>
          </div>
        </FieldShell>
        {picker && (
          <div id="emoji-picker" role="listbox" aria-label="Selettore emoji" className="grid grid-cols-8 gap-1 rounded-[2px] border border-ink/30 bg-parchment-light p-2 sm:grid-cols-12">
            {EMOJI.map((e) => (
              <button key={e} type="button" role="option" aria-selected={false} className="rounded p-1 text-xl hover:bg-brass/30" onClick={() => insertEmoji(e)} aria-label={`Inserisci ${e}`}>
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldShell label="Categoria" htmlFor="a-cat">
            <Select id="a-cat" {...register("category")}>
              {ANNOUNCEMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ANNOUNCEMENT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label="Priorità" htmlFor="a-prio">
            <Select id="a-prio" {...register("priority")}>
              {ANNOUNCEMENT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {ANNOUNCEMENT_PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label="Data di pubblicazione" htmlFor="a-pub" error={errors.publishedAt}>
            <Input id="a-pub" type="date" {...register("publishedAt")} />
          </FieldShell>
          <FieldShell label="Scadenza (facoltativa)" htmlFor="a-exp" error={errors.expiresAt}>
            <Input id="a-exp" type="date" invalid={!!errors.expiresAt} {...register("expiresAt")} />
          </FieldShell>
          <FieldShell label="Stato" htmlFor="a-status">
            <Select id="a-status" {...register("status")}>
              <option value="PUBBLICATO">Pubblicato</option>
              <option value="BOZZA">Bozza</option>
            </Select>
          </FieldShell>
          <label className="flex items-center gap-2 self-end pb-2">
            <input type="checkbox" className="h-5 w-5 accent-[#722F32]" {...register("pinned")} />
            <span className="font-heading">Fissa in cima alla bacheca</span>
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
            Annulla
          </button>
          <button className="btn btn-ink" disabled={isSubmitting}>
            <Save size={17} aria-hidden /> {isSubmitting ? "Affissione…" : id ? "Salva modifiche" : "Affiggi strillone"}
          </button>
        </div>
      </div>

      <div>
        <p className="carved mb-3 font-heading text-lg">Anteprima del manifesto</p>
        <div className="paper board-sheet relative" style={{ ["--tilt" as string]: "-0.6deg" }}>
          <span className="pin" aria-hidden />
          <Poster
            a={{
              title: v.title ?? "",
              content: v.content ?? "",
              category: (v.category ?? "AVVISO") as AnnouncementCategory,
              priority: (v.priority ?? "NORMALE") as AnnouncementPriority,
              pinned: !!v.pinned,
              publishedAt: v.publishedAt ? `${v.publishedAt}T12:00:00Z` : null,
              expiresAt: v.expiresAt ? `${v.expiresAt}T12:00:00Z` : null,
              draft: v.status === "BOZZA",
            }}
          />
        </div>
      </div>
    </form>
  );
}
