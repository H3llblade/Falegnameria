"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="it">
      <body style={{ background: "#35251B", color: "#E8D8B5", fontFamily: "Georgia, serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Errore imprevisto</h1>
        <p>Il registro non è al momento consultabile.</p>
        <button onClick={reset} style={{ padding: ".6rem 1.2rem", marginTop: "1rem" }}>
          Riprova
        </button>
      </body>
    </html>
  );
}
