"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className="field-label">
          Nome utente
        </label>
        <input id="username" name="username" className="input" autoComplete="username" required autoFocus={!state?.username} maxLength={60} defaultValue={state?.username} />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Parola d&apos;ordine
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required maxLength={200} autoFocus={!!state?.username} />
      </div>
      {state?.error && (
        <p role="alert" className="border-l-4 border-bordeaux bg-bordeaux/10 px-3 py-2 font-fell italic text-bordeaux">
          {state.error}
        </p>
      )}
      <button className="btn btn-ink w-full" disabled={pending}>
        <KeyRound size={17} aria-hidden /> {pending ? "Verifica in corso…" : "Apri il registro"}
      </button>
    </form>
  );
}
