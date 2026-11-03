/**
 * Gestione monetaria con interi (centesimi). Nessun floating point nei calcoli.
 */

export class MoneyParseError extends Error {}

/**
 * Converte una stringa inserita dall'utente in centesimi.
 * Accetta: "12", "12,5", "12,50", "12.50", "1.250", "1.250,75", "1,250.75", "$ 30".
 * Regole: se compaiono sia "." sia ",", l'ultimo è il separatore decimale.
 * Con il solo "." in forma 1.234(.567) viene interpretato come separatore delle migliaia.
 */
export function parseMoneyToCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined) throw new MoneyParseError("Importo mancante");
  if (typeof input === "number") {
    if (!Number.isInteger(input)) throw new MoneyParseError("Usare stringhe per importi decimali");
    return input * 100;
  }
  let s = input.trim().replace(/\$/g, "").replace(/\s+/g, "").replace(/'/g, "");
  if (s === "") throw new MoneyParseError("Importo mancante");
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let intPart: string;
  let decPart = "";
  if (lastDot >= 0 && lastComma >= 0) {
    const decSep = lastDot > lastComma ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";
    const idx = s.lastIndexOf(decSep);
    intPart = s.slice(0, idx).split(thouSep).join("");
    decPart = s.slice(idx + 1);
  } else if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(s) && s.split(",").length > 2) {
      intPart = s.split(",").join("");
    } else {
      const idx = lastComma;
      intPart = s.slice(0, idx);
      decPart = s.slice(idx + 1);
    }
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      intPart = s.split(".").join("");
    } else {
      intPart = s.slice(0, lastDot);
      decPart = s.slice(lastDot + 1);
    }
  } else {
    intPart = s;
  }
  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(decPart)) {
    throw new MoneyParseError("Importo non valido");
  }
  if (decPart.length > 2) throw new MoneyParseError("Massimo due decimali");
  if (intPart.length > 9) throw new MoneyParseError("Importo troppo grande");
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Raggruppamento migliaia deterministico (uguale su server e browser) */
export function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Formatta centesimi come "$ 1.250,00" */
export function formatCents(cents: number | null | undefined, opts: { sign?: boolean } = {}): string {
  const c = cents ?? 0;
  const neg = c < 0;
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const prefix = neg ? "−" : opts.sign && c > 0 ? "+" : "";
  return `${prefix}$ ${groupThousands(whole)},${frac}`;
}

/** Rappresentazione per i campi di input: "1250,00" */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

export function safeParseMoney(input: string): number | null {
  try {
    return parseMoneyToCents(input);
  } catch {
    return null;
  }
}

export type PaymentState = "NON_PAGATO" | "PARZIALE" | "PAGATO";

export function paymentState(totalCents: number, paidCents: number): PaymentState {
  if (paidCents <= 0) return totalCents <= 0 ? "PAGATO" : "NON_PAGATO";
  if (paidCents >= totalCents) return "PAGATO";
  return "PARZIALE";
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  NON_PAGATO: "Non pagato",
  PARZIALE: "Parzialmente pagato",
  PAGATO: "Pagato",
};
