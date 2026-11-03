"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="paper frame mx-auto max-w-xl px-6 py-10 text-center" role="alert">
      <p className="font-display text-2xl text-bordeaux">Un intoppo in bottega</p>
      <p className="mt-3 font-fell text-lg italic">
        Non è stato possibile completare l&apos;operazione. Verificate la connessione e riprovate.
      </p>
      {error.digest && <p className="num mt-2 text-xs text-ink-soft">Rif. {error.digest}</p>}
      <button className="btn btn-ink mt-5" onClick={reset}>
        Riprova
      </button>
    </div>
  );
}
