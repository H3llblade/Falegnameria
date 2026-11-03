"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, KeyRound, LogOut, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { changePasswordAction, createUserAction, logoutEverywhereAction, setUserActiveAction } from "@/app/actions/auth";
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from "@/app/actions/recipes";
import { passwordChangeSchema, userCreateSchema } from "@/lib/validation/schemas";
import { formatDateTime } from "@/lib/labels";
import { applyServerErrors, FieldShell, Input, Select } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/dialog";
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

export function CategoriesManager({ categories }: { categories: { id: string; name: string; count: number }[] }) {
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

type UserRow = { id: string; username: string; displayName: string; role: "ADMIN" | "STAFF"; active: boolean; lastLoginAt: string | null };

export function UsersManager({ users, meId }: { users: UserRow[]; meId: string }) {
  const router = useRouter();
  const toast = useActionToast();
  const [show, setShow] = useState(false);
  const form = useForm({ resolver: zodResolver(userCreateSchema), defaultValues: { username: "", displayName: "", password: "", role: "STAFF" as const } });
  const e = form.formState.errors;
  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th>Utente</th>
              <th>Ruolo</th>
              <th>Ultimo accesso</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.displayName} <span className="num text-sm text-ink-soft">({u.username})</span>
                </td>
                <td>{u.role === "ADMIN" ? "Amministratore" : "Collaboratore"}</td>
                <td className="num text-sm">{formatDateTime(u.lastLoginAt)}</td>
                <td>
                  {u.id === meId ? (
                    <span className="font-fell italic">voi</span>
                  ) : (
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!show ? (
        <button type="button" className="btn btn-paper btn-sm mt-3" onClick={() => setShow(true)}>
          <UserPlus size={15} aria-hidden /> Aggiungi utente
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
          <FieldShell label="Nome utente" htmlFor="u-n" error={e.username}>
            <Input id="u-n" autoComplete="off" invalid={!!e.username} {...form.register("username")} />
          </FieldShell>
          <FieldShell label="Nome visualizzato" htmlFor="u-d" error={e.displayName}>
            <Input id="u-d" invalid={!!e.displayName} {...form.register("displayName")} />
          </FieldShell>
          <FieldShell label="Password iniziale" htmlFor="u-p" error={e.password}>
            <Input id="u-p" type="password" autoComplete="new-password" invalid={!!e.password} {...form.register("password")} />
          </FieldShell>
          <FieldShell label="Ruolo" htmlFor="u-r">
            <Select id="u-r" {...form.register("role")}>
              <option value="STAFF">Collaboratore</option>
              <option value="ADMIN">Amministratore</option>
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
    </div>
  );
}
