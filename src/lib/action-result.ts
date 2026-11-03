import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";
import { DomainError } from "@/lib/services/errors";
import { MoneyParseError } from "@/lib/money";

export type ActionResult<T = void> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Esegue un'azione e converte ogni errore in un messaggio sicuro per l'utente */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return { ok: false, error: e.issues[0]?.message ?? "Dati non validi", fieldErrors };
    }
    if (e instanceof DomainError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof MoneyParseError) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") return { ok: false, error: "Elemento non trovato o già rimosso" };
      if (e.code === "P2002") return { ok: false, error: "Esiste già un elemento con questi dati" };
      if (e.code === "P2003") return { ok: false, error: "Operazione non consentita: elemento collegato ad altri dati" };
    }
    // Log lato server senza dati sensibili; all'utente un messaggio generico
    console.error("[azione] errore imprevisto:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return { ok: false, error: "Si è verificato un errore imprevisto. Riprovare." };
  }
}
