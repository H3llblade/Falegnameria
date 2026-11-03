import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="paper frame max-w-lg px-8 py-10 text-center">
        <p className="font-display text-3xl">Foglio non trovato</p>
        <p className="mt-3 font-fell text-lg italic text-ink-soft">Questa pagina non è appesa ad alcun chiodo della bottega.</p>
        <Link href="/" className="btn btn-ink mt-6">
          Torna al registro
        </Link>
      </div>
    </main>
  );
}
