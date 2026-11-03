"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Coins, Copy, Eye, KeyRound, LogOut, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import {
  changePasswordAction,
  createUserAction,
  logoutEverywhereAction,
  resetUserPasswordAction,
  setPublicSectionsAction,
  setUserActiveAction,
  updateUserAction,
} from "@/app/actions/auth";
import { setPurchaseProductsAction } from "@/app/actions/settings";
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from "@/app/actions/recipes";
import { passwordChangeSchema, userCreateSchema, purchaseProductsSchema, type PurchaseProductsInput } from "@/lib/validation/schemas";
import { formatDateTime } from "@/lib/labels";
import { applyServerErrors, FieldShell, Input, Select } from "@/components/ui/form";
import { Modal, useConfirm } from "@/components/ui/dialog";
import { useActionToast } from "@/components/ui/toast";

export function PasswordForm() {
  const toast = useActionToast();
  const form = useForm({ resolver: zodResolver(passwordChangeSchema), defaultValues: { current: "", next: "", confirm: "" } });
  const e = form.formState.errors;
  return (
    <form
      noValidate
      className="mt-3 space-y-3"
      onSubmit={form.handleSubmit(async (v) => {
        const r = await changePasswordAction(v);
        toast(r);
        if (r.ok) form.reset();
        else applyServerErrors(r.fieldErrors, form.setError);
      })}
    >
      <FieldShell label="Password attuale" htmlFor="pw-c" error={e.current}>
        <Input id="pw-c" type="password" autoComplete="current-password" invalid={!!e.current} {...form.register("current")} />
      </FieldShell>
      <FieldShell label="Nuova password" htmlFor="pw-n" error={e.next} hint="Almeno 10 caratteri, con lettere e numeri">
        <Input id="pw-n" type="password" autoComplete="new-password" invalid={!!e.next} {...form.register("next")} />
      </FieldShell>
      <FieldShell label="Ripeti la nuova password" htmlFor="pw-r" error={e.confirm}>
        <Input id="pw-r" type="password" autoComplete="new-password" invalid={!!e.confirm} {...form.register("confirm")} />
      </FieldShell>
      <button className="btn btn-ink" disabled={form.formState.isSubmitting}>
        <KeyRound size={16} aria-hidden /> Aggiorna password
      </button>
    </form>
  );
}

export function SessionsBox({ count }: { count: number }) {
  const confirm = useConfirm();
  return (
    <div className="mt-3">
      <p>
        Sessioni attive del vostro account: <span className="num">{count}</span>
      </p>
      <button
        type="button"
        className="btn btn-paper btn-sm mt-2"
        onClick={async () => {
          const r = await confirm({ title: "Uscire da tutti i dispositivi?", body: "Tutte le sessioni, compresa questa, verranno chiuse.", confirmLabel: "Esci ovunque" });
          if (r.confirmed) await logoutEverywhereAction();
        }}
      >
        <LogOut size={15} aria-hidden /> Esci da tutti i dispositivi
      </button>
    </div>
  );
}

export function CategoriesManager({ categories, isAdmin }: { categories: { id: string; name: string; count: number }[]; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useActionToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      if (toast(await fn())) after?.();
      router.refresh();
    });

  return (
    <div className="mt-3">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 border border-ink/20 bg-parchment-light/50 px-3 py-1.5">
            {editing?.id === c.id ? (
              <form
                className="flex flex-1 items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => renameCategoryAction(c.id, { name: editing.name }), () => setEditing(null));
                }}
              >
                <input className="input !min-h-[2rem] !py-0.5" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus aria-label="Nuovo nome" />
                <button className="btn btn-ghost btn-sm" aria-label="Salva" disabled={pending}>
                  <Check size={15} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Annulla" onClick={() => setEditing(null)}>
                  <X size={15} />
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 font-heading">{c.name}</span>
                <span className="num text-xs text-ink-soft">{c.count}</span>
                <button type="button" className="btn btn-ghost btn-sm !px-1.5" aria-label={`Rinomina ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                  <Pencil size={14} />
                </button>
                {isAdmin && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm !px-1.5 text-bordeaux"
                  aria-label={`Elimina ${c.name}`}
                  onClick={async () => {
                    const r = await confirm({
                      title: `Eliminare la categoria «${c.name}»?`,
                      body: c.count ? `Le ${c.count} ricette collegate resteranno senza categoria.` : undefined,
                      confirmLabel: "Elimina",
                      danger: true,
                    });
                    if (r.confirmed) run(() => deleteCategoryAction(c.id));
                  }}
                >
                  <Trash2 size={14} />
                </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createCategoryAction({ name }), () => setName(""));
        }}
      >
        <input className="input" placeholder="Nuova categoria" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome nuova categoria" maxLength={60} />
        <button className="btn btn-brass" disabled={pending || !name.trim()}>
          <Plus size={16} aria-hidden /> Aggiungi
        </button>
      </form>
    </div>
  );
}

export function PurchaseProductsForm({ initial }: { initial: PurchaseProductsInput["products"] }) {
  const router = useRouter();
  const toast = useActionToast();
  const form = useForm<PurchaseProductsInput>({ resolver: zodResolver(purchaseProductsSchema), defaultValues: { products: initial } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "products" });
  const e = form.formState.errors.products;
  return (
    <form
      noValidate
      className="mt-3"
      onSubmit={form.handleSubmit(async (v) => {
        const r = await setPurchaseProductsAction(v);
        toast(r);
        if (r.ok) router.refresh();
        else applyServerErrors(r.fieldErrors, form.setError);
      })}
    >
      <p className="font-fell italic text-ink-soft">
        Ciò che la bottega compra da terzi e quanto paga per ogni unità. L&apos;elenco compare nel Registro generale e nel calcolatore
        «Acquisti».
      </p>
      <ul className="mt-3 space-y-2">
        <li className="hidden grid-cols-[1fr_7rem_8rem_auto] gap-2 sm:grid" aria-hidden>
          <span className="field-label !mb-0">Prodotto</span>
          <span className="field-label !mb-0">Unità</span>
          <span className="field-label !mb-0">Prezzo ($)</span>
          <span className="w-9" />
        </li>
        {fields.map((f, i) => (
          <li key={f.id} className="grid grid-cols-[1fr_7rem_8rem_auto] items-start gap-2 max-sm:grid-cols-[1fr_1fr_auto]">
            <div className="max-sm:col-span-3">
              <Input aria-label={`Prodotto ${i + 1}`} placeholder="Es. Legno pregiato" invalid={!!e?.[i]?.name} {...form.register(`products.${i}.name`)} />
              {e?.[i]?.name && <p className="font-fell text-sm italic text-bordeaux">{e[i]!.name!.message}</p>}
            </div>
            <Input aria-label={`Unità ${i + 1}`} placeholder="pz, kg…" {...form.register(`products.${i}.unit`)} />
            <div>
              <Input aria-label={`Prezzo ${i + 1}`} inputMode="decimal" className="num" placeholder="0,00" invalid={!!e?.[i]?.price} {...form.register(`products.${i}.price`)} />
              {e?.[i]?.price && <p className="font-fell text-sm italic text-bordeaux">{e[i]!.price!.message}</p>}
            </div>
            <button type="button" className="btn btn-ghost btn-sm text-bordeaux" onClick={() => remove(i)} aria-label={`Rimuovi prodotto ${i + 1}`}>
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {fields.length === 0 && <p className="mt-2 font-fell italic text-ink-soft">Nessun prodotto: l&apos;elenco non verrà mostrato.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-paper btn-sm" onClick={() => append({ id: "", name: "", unit: "pz", price: "" })}>
          <Plus size={15} aria-hidden /> Aggiungi prodotto
        </button>
        <button className="btn btn-ink btn-sm" disabled={form.formState.isSubmitting}>
          <Coins size={15} aria-hidden /> Salva prodotti
        </button>
      </div>
    </form>
  );
}

export function PublicSectionsForm({ sections, labels, initial }: { sections: string[]; labels: Record<string, string>; initial: string[] }) {
  const router = useRouter();
  const toast = useActionToast();
  const [sel, setSel] = useState<string[]>(initial);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3">
      <p className="font-fell italic text-ink-soft">
        Le sezioni spuntate sono consultabili da chiunque, senza accesso e in sola lettura (niente bozze né elementi archiviati). Non esiste
        alcuna registrazione pubblica: solo l&apos;amministratore crea gli account dei gestori.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#596044]"
                checked={sel.includes(s)}
                onChange={(e) => setSel((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))}
              />
              <span>{labels[s]}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-ink btn-sm mt-3"
        disabled={pending}
        onClick={() =>
          start(async () => {
            toast(await setPublicSectionsAction(sel));
            router.refresh();
          })
        }
      >
        <Eye size={15} aria-hidden /> Salva visibilità
      </button>
    </div>
  );
}

type UserRow = { id: string; username: string; displayName: string; role: "ADMIN" | "STAFF"; active: boolean; lastLoginAt: string | null };

const ROLE_LABEL = { ADMIN: "Amministratore", STAFF: "Gestore" } as const;

export function UsersManager({ users, meId }: { users: UserRow[]; meId: string }) {
  const router = useRouter();
  const toast = useActionToast();
  const confirm = useConfirm();
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [revealed, setRevealed] = useState<{ user: UserRow; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm({ resolver: zodResolver(userCreateSchema), defaultValues: { username: "", displayName: "", password: "", role: "STAFF" as const } });
  const e = form.formState.errors;

  const resetPassword = async (u: UserRow) => {
    const r = await confirm({
      title: `Nuova password per ${u.displayName}?`,
      body: "Verrà generata una password nuova, mostrata una sola volta. Quella attuale smetterà di funzionare e le sessioni aperte dell'utente verranno chiuse.",
      confirmLabel: "Genera nuova password",
    });
    if (!r.confirmed) return;
    const res = await resetUserPasswordAction(u.id);
    toast(res);
    if (res.ok && res.data) {
      setCopied(false);
      setRevealed({ user: u, password: res.data.password });
    }
  };

  return (
    <div className="mt-3">
      <p className="font-fell italic text-ink-soft">
        Le password non sono mai visibili: nel registro ne è conservata solo un&apos;impronta cifrata, da cui non si può risalire all&apos;originale.
        Per consegnare l&apos;accesso a un gestore usate «Nuova password»: la vedrete una sola volta, da comunicargli.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th>Utente</th>
              <th>Ruolo</th>
              <th>Ultimo accesso</th>
              <th>Stato</th>
              <th>
                <span className="sr-only">Azioni</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                <td>
                  {u.displayName} <span className="num text-sm text-ink-soft">({u.username})</span>
                </td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td className="num text-sm whitespace-nowrap">{formatDateTime(u.lastLoginAt)}</td>
                <td>{u.active ? "Attivo" : "Disattivato"}</td>
                <td>
                  <div className="flex flex-wrap justify-end gap-1">
                    <button type="button" className="btn btn-paper btn-sm" onClick={() => setEditing(u)}>
                      <Pencil size={14} aria-hidden /> Modifica
                    </button>
                    <button type="button" className="btn btn-paper btn-sm" onClick={() => resetPassword(u)}>
                      <KeyRound size={14} aria-hidden /> Nuova password
                    </button>
                    {u.id !== meId && (
                      <button
                        type="button"
                        className={`btn btn-sm ${u.active ? "btn-paper" : "btn-olive"}`}
                        onClick={async () => {
                          toast(await setUserActiveAction(u.id, !u.active));
                          router.refresh();
                        }}
                      >
                        {u.active ? "Disattiva" : "Riattiva"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!show ? (
        <button type="button" className="btn btn-brass btn-sm mt-3" onClick={() => setShow(true)}>
          <UserPlus size={15} aria-hidden /> Aggiungi gestore
        </button>
      ) : (
        <form
          noValidate
          className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit(async (v) => {
            const r = await createUserAction(v);
            toast(r);
            if (r.ok) {
              form.reset();
              setShow(false);
              router.refresh();
            } else applyServerErrors(r.fieldErrors, form.setError);
          })}
        >
          <FieldShell label="Nome utente (per l'accesso)" htmlFor="u-n" error={e.username}>
            <Input id="u-n" autoComplete="off" invalid={!!e.username} {...form.register("username")} />
          </FieldShell>
          <FieldShell label="Nome visualizzato" htmlFor="u-d" error={e.displayName}>
            <Input id="u-d" invalid={!!e.displayName} {...form.register("displayName")} />
          </FieldShell>
          <FieldShell label="Password iniziale" htmlFor="u-p" error={e.password} hint="Almeno 10 caratteri, lettere e numeri">
            <Input id="u-p" type="text" autoComplete="new-password" invalid={!!e.password} {...form.register("password")} />
          </FieldShell>
          <FieldShell label="Ruolo" htmlFor="u-r">
            <Select id="u-r" {...form.register("role")}>
              <option value="STAFF">Gestore — crea e modifica, non elimina</option>
              <option value="ADMIN">Amministratore — tutto, comprese eliminazioni e utenti</option>
            </Select>
          </FieldShell>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn btn-ink" disabled={form.formState.isSubmitting}>
              Crea utente
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>
              Annulla
            </button>
          </div>
        </form>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifica utente">
        {editing && <EditUserForm user={editing} isMe={editing.id === meId} onDone={() => setEditing(null)} />}
      </Modal>

      <Modal open={!!revealed} onClose={() => setRevealed(null)} title="Nuova password">
        {revealed && (
          <div className="space-y-4">
            <p>
              Password per <strong>{revealed.user.displayName}</strong> (utente <span className="num">{revealed.user.username}</span>):
            </p>
            <p className="num select-all break-all border-2 border-dashed border-ink/50 bg-parchment-light px-4 py-3 text-center text-xl">{revealed.password}</p>
            <p className="font-fell italic text-bordeaux">
              Copiatela ora e comunicatela al gestore: chiusa questa finestra non sarà più possibile rivederla.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-paper"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(revealed.password);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy size={15} aria-hidden /> {copied ? "Copiata" : "Copia"}
              </button>
              <button type="button" className="btn btn-ink" onClick={() => setRevealed(null)}>
                Fatto
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EditUserForm({ user, isMe, onDone }: { user: UserRow; isMe: boolean; onDone: () => void }) {
  const router = useRouter();
  const toast = useActionToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<"ADMIN" | "STAFF">(user.role);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateUserAction(user.id, { displayName, role });
          toast(r);
          if (r.ok) {
            router.refresh();
            onDone();
          }
        });
      }}
    >
      <FieldShell label="Nome visualizzato" htmlFor="eu-d">
        <Input id="eu-d" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
      </FieldShell>
      <FieldShell label="Ruolo" htmlFor="eu-r" hint={isMe ? "Non potete togliere a voi stessi il ruolo di amministratore" : undefined}>
        <Select id="eu-r" value={role} disabled={isMe} onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}>
          <option value="STAFF">Gestore</option>
          <option value="ADMIN">Amministratore</option>
        </Select>
      </FieldShell>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-paper" onClick={onDone}>
          Annulla
        </button>
        <button className="btn btn-ink" disabled={pending}>
          Salva
        </button>
      </div>
    </form>
  );
}
