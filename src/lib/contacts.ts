/** Utility pure per la rubrica (ordinamento italiano, duplicati, CSV). */

export const itCollator = new Intl.Collator("it", { sensitivity: "base", ignorePunctuation: true });

export type NameLike = { name: string };

export function compareContacts(a: NameLike, b: NameLike): number {
  return itCollator.compare(a.name, b.name);
}

export function sortContacts<T extends NameLike>(list: T[]): T[] {
  return [...list].sort(compareContacts);
}

/** Lettera indice per il registro alfabetico (accenti normalizzati) */
export function indexLetter(name: string): string {
  const ch = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
}

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeCode(s: string): string {
  return s.trim().toUpperCase().replace(/[\s#.\-_/]/g, "");
}

export type DupCandidate = { id: string; name: string; missiveCode: string };

export type DupMatch = { id: string; reason: "codice" | "nome"; label: string };

/** Possibili duplicati: stesso codice missiva oppure stesso nome e cognome (normalizzati) */
export function findDuplicates(row: { name: string; missiveCode: string }, existing: DupCandidate[], excludeId?: string): DupMatch[] {
  const code = normalizeCode(row.missiveCode);
  const full = normalizeName(row.name);
  const out: DupMatch[] = [];
  for (const c of existing) {
    if (c.id === excludeId) continue;
    const label = `${c.name} (${c.missiveCode})`;
    if (code && normalizeCode(c.missiveCode) === code) {
      out.push({ id: c.id, reason: "codice", label });
      continue;
    }
    if (full.length > 1 && normalizeName(c.name) === full) out.push({ id: c.id, reason: "nome", label });
  }
  return out;
}

/** Cella CSV con protezione da formula injection */
export function csvCell(value: string | null | undefined): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  if (/[";\n\r,]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/** Parser CSV minimale (separatore ; o , auto-rilevato, virgolette RFC 4180) */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep || ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}
