/**
 * Parser verificabile del testo OCR → contatti.
 * Non inventa dati: un campo non leggibile resta vuoto e viene segnalato come incerto.
 *
 * Strategie (in ordine):
 *  1. Blocchi "chiave: valore" (Nome: …, Cognome: …, Codice missiva: …, Attività: …)
 *  2. Tabella con riga di intestazione: le colonne si ricavano dalle coordinate X delle parole
 *  3. Righe libere "Nome Cognome – 01234 – Attività" (separatori | ; – - tab o spazi multipli)
 *  4. Schede su più righe (nome / codice / attività su righe consecutive)
 */

export type OcrWord = { text: string; confidence: number; x0: number; x1: number };
export type OcrLine = { text: string; confidence: number; words: OcrWord[] };

export type Field = "firstName" | "lastName" | "missiveCode" | "activity";
export const FIELDS: Field[] = ["firstName", "lastName", "missiveCode", "activity"];

export type ParsedContact = {
  firstName: string;
  lastName: string;
  missiveCode: string;
  activity: string;
  confidence: Record<Field, number>;
  warnings: string[];
  source: string;
  strategy: "chiave-valore" | "tabella" | "riga" | "scheda";
};

export const LOW_CONFIDENCE = 75;

const KEY_PATTERNS: [RegExp, Field | "fullName" | "ignore"][] = [
  [/^(nome\s*(e|&)\s*cognome|nominativo)$/i, "fullName"],
  [/^(cognome|surname|last\s*name)$/i, "lastName"],
  [/^(nome|name|first\s*name)$/i, "firstName"],
  [/^(cod(ice)?\.?\s*(missiva|telegramma|postale)?|missiva|telegramma|n[°º.]?\s*missiva|id|codice\s*id|p\.?o\.?\s*box)$/i, "missiveCode"],
  [/^(attivit[aà]|descrizione(\s*attivit[aà])?|mestiere|professione|lavoro|occupazione|ruolo|impiego)$/i, "activity"],
  [/^(citt[aà]|luogo|residenza|contea)$/i, "ignore"],
];

function keyOf(label: string): Field | "fullName" | "ignore" | null {
  const l = label.trim().replace(/[.:]+$/, "").trim();
  for (const [re, f] of KEY_PATTERNS) if (re.test(l)) return f;
  return null;
}

const CODE_RE = /(?:^|[\s#(\[])((?:[A-Z]{1,4}[-\s]?)?\d[\d\-./]{2,}[A-Z0-9]*)(?=$|[\s)\],;|])/i;

export function cleanText(s: string): string {
  return s
    .replace(/[​-‍﻿]/g, "")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ripulisce i nomi: solo lettere, apostrofi, trattini, spazi */
function cleanName(s: string): string {
  return cleanText(s)
    .replace(/[^\p{L}' \-.]/gu, "")
    .replace(/^[\s.\-']+|[\s.\-']+$/g, "")
    .replace(/\s+/g, " ");
}

function cleanCode(s: string): string {
  return cleanText(s).replace(/^[#:\s]+/, "").replace(/[\s,;|]+$/g, "");
}

function cleanActivity(s: string): string {
  return cleanText(s).replace(/^[\s\-–—|:;,]+|[\s\-–—|:;,]+$/g, "");
}

function splitFullName(full: string): { firstName: string; lastName: string } {
  const f = cleanText(full);
  if (f.includes(",")) {
    const [last, first] = f.split(",", 2);
    return { firstName: cleanName(first), lastName: cleanName(last) };
  }
  const parts = cleanName(f).split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function avg(nums: number[]): number {
  const v = nums.filter((n) => Number.isFinite(n));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}

/** Confidenza media delle parole OCR che compongono un frammento di testo */
function confidenceFor(fragment: string, line: OcrLine): number {
  if (!fragment) return 0;
  const tokens = fragment.toLowerCase().split(/\s+/).filter(Boolean);
  const hits: number[] = [];
  for (const t of tokens) {
    const w = line.words.find((w) => w.text.toLowerCase().includes(t) || t.includes(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")));
    if (w) hits.push(w.confidence);
  }
  return hits.length ? avg(hits) : Math.round(line.confidence);
}

function finalize(
  p: Omit<ParsedContact, "warnings" | "confidence"> & { confidence: Partial<Record<Field, number>> },
): ParsedContact {
  const confidence = {} as Record<Field, number>;
  const warnings: string[] = [];
  for (const f of FIELDS) {
    const val = p[f];
    confidence[f] = val ? Math.max(0, Math.min(100, p.confidence[f] ?? 0)) : 0;
  }
  if (!p.missiveCode) warnings.push("Codice missiva non riconosciuto");
  else if (/[OoIl|]/.test(p.missiveCode) && /\d/.test(p.missiveCode)) {
    warnings.push("Il codice contiene lettere simili a cifre (O/0, I/1): verificare");
    confidence.missiveCode = Math.min(confidence.missiveCode, LOW_CONFIDENCE - 1);
  }
  if (!p.lastName) warnings.push("Cognome mancante");
  if (!p.activity) warnings.push("Attività non riconosciuta");
  return { ...p, confidence, warnings };
}

function isNoise(text: string): boolean {
  const t = cleanText(text);
  if (t.length < 3) return true;
  if (!/[\p{L}\p{N}]/u.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------- 1. chiave: valore
function parseKeyValue(lines: OcrLine[]): ParsedContact[] | null {
  const kvLines = lines.filter((l) => /^[^:]{2,30}[:]\s*\S/.test(cleanText(l.text)) && keyOf(cleanText(l.text).split(":")[0]));
  if (kvLines.length < 2) return null;
  const out: ParsedContact[] = [];
  let cur: Record<string, { v: string; c: number }> = {};
  let src: string[] = [];
  const flush = () => {
    if (Object.keys(cur).length === 0) return;
    let firstName = cur.firstName?.v ?? "";
    let lastName = cur.lastName?.v ?? "";
    const conf: Partial<Record<Field, number>> = {
      firstName: cur.firstName?.c,
      lastName: cur.lastName?.c,
      missiveCode: cur.missiveCode?.c,
      activity: cur.activity?.c,
    };
    if (cur.fullName && !firstName && !lastName) {
      ({ firstName, lastName } = splitFullName(cur.fullName.v));
      conf.firstName = conf.lastName = cur.fullName.c;
    }
    out.push(
      finalize({
        firstName: cleanName(firstName),
        lastName: cleanName(lastName),
        missiveCode: cleanCode(cur.missiveCode?.v ?? ""),
        activity: cleanActivity(cur.activity?.v ?? ""),
        confidence: conf,
        source: src.join(" / "),
        strategy: "chiave-valore",
      }),
    );
    cur = {};
    src = [];
  };
  for (const line of lines) {
    const t = cleanText(line.text);
    const m = t.match(/^([^:]{2,30}):\s*(.*)$/);
    const key = m ? keyOf(m[1]) : null;
    if (!m || !key) continue;
    if (key === "ignore") continue;
    if (cur[key]) flush();
    cur[key] = { v: m[2], c: confidenceFor(m[2], line) };
    src.push(t);
  }
  flush();
  return out.length ? out : null;
}

// ---------------------------------------------------------------- 2. tabella con intestazione
type Column = { field: Field | "fullName" | "ignore"; x: number };

function detectHeader(line: OcrLine): Column[] | null {
  const words = line.words.filter((w) => w.text.trim());
  const cols: Column[] = [];
  for (let i = 0; i < words.length; i++) {
    // prova coppie di parole ("Codice missiva", "Nome e cognome") prima delle singole
    for (const span of [3, 2, 1]) {
      const chunk = words.slice(i, i + span);
      if (chunk.length < span) continue;
      const k = keyOf(chunk.map((w) => w.text).join(" ").replace(/[|:]/g, ""));
      if (k) {
        cols.push({ field: k, x: chunk[0].x0 });
        i += span - 1;
        break;
      }
    }
  }
  const relevant = cols.filter((c) => c.field !== "ignore");
  return relevant.length >= 2 ? cols.sort((a, b) => a.x - b.x) : null;
}

function parseTable(lines: OcrLine[]): ParsedContact[] | null {
  const hIdx = lines.findIndex((l) => detectHeader(l));
  if (hIdx < 0) return null;
  const cols = detectHeader(lines[hIdx])!;
  const out: ParsedContact[] = [];
  for (const line of lines.slice(hIdx + 1)) {
    if (isNoise(line.text) || detectHeader(line)) continue;
    const buckets: { text: string[]; conf: number[] }[] = cols.map(() => ({ text: [], conf: [] }));
    for (const w of line.words) {
      if (!w.text.trim() || /^[|]+$/.test(w.text)) continue;
      const center = (w.x0 + w.x1) / 2;
      // colonna = ultima intestazione che inizia prima del centro della parola (con tolleranza)
      let idx = 0;
      for (let i = 0; i < cols.length; i++) if (center >= cols[i].x - 12) idx = i;
      buckets[idx].text.push(w.text.replace(/\|/g, ""));
      buckets[idx].conf.push(w.confidence);
    }
    const rec: Partial<Record<Field, string>> = {};
    const conf: Partial<Record<Field, number>> = {};
    cols.forEach((c, i) => {
      const txt = buckets[i].text.join(" ").trim();
      const cf = avg(buckets[i].conf);
      if (c.field === "fullName") {
        const s = splitFullName(txt);
        rec.firstName = s.firstName;
        rec.lastName = s.lastName;
        conf.firstName = conf.lastName = cf;
      } else if (c.field !== "ignore") {
        rec[c.field] = txt;
        conf[c.field] = cf;
      }
    });
    if (!rec.firstName && !rec.lastName && !rec.missiveCode) continue;
    out.push(
      finalize({
        firstName: cleanName(rec.firstName ?? ""),
        lastName: cleanName(rec.lastName ?? ""),
        missiveCode: cleanCode(rec.missiveCode ?? ""),
        activity: cleanActivity(rec.activity ?? ""),
        confidence: conf,
        source: cleanText(line.text),
        strategy: "tabella",
      }),
    );
  }
  return out.length ? out : null;
}

// ---------------------------------------------------------------- 3. righe libere
function parseFreeLine(line: OcrLine): ParsedContact | null {
  const t = cleanText(line.text);
  if (isNoise(t)) return null;
  const m = t.match(CODE_RE);
  if (!m || m.index === undefined) return null;
  const code = m[1];
  const start = t.indexOf(code, m.index);
  let before = t.slice(0, start).replace(/[#(\[]\s*$/, "");
  const after = t.slice(start + code.length).replace(/^\s*[)\]]/, "");
  // rimuove etichette tipo "cod.", "n°", "missiva"
  before = before.replace(/\b(cod(ice)?\.?|n[°º.]|missiva|telegramma)\s*[:#]?\s*$/i, "");
  const segs = before.split(/\s*(?:\||;|\t| [-–—] |\s{2,})\s*/).filter((s) => cleanName(s));
  let namePart = segs[0] ?? "";
  let activity = after;
  // Se l'attività compare prima del codice (es. "Mario Rossi – Fabbro – 0123")
  if (segs.length >= 2 && !cleanActivity(after)) {
    namePart = segs[0];
    activity = segs.slice(1).join(" ");
  }
  if (!cleanName(namePart)) return null;
  const { firstName, lastName } = splitFullName(namePart);
  const words = cleanName(namePart).split(" ");
  // Righe senza separatori: "Mario Rossi Fabbro 0123" → nome = prime 2 parole
  if (segs.length === 1 && !cleanActivity(after) && words.length > 2) {
    const fn = words[0];
    const ln = words[1];
    activity = words.slice(2).join(" ");
    return finalize({
      firstName: fn,
      lastName: ln,
      missiveCode: cleanCode(code),
      activity: cleanActivity(activity),
      confidence: {
        firstName: confidenceFor(fn, line),
        lastName: Math.min(confidenceFor(ln, line), LOW_CONFIDENCE - 1), // separazione nome/attività incerta
        missiveCode: confidenceFor(code, line),
        activity: Math.min(confidenceFor(activity, line), LOW_CONFIDENCE - 1),
      },
      source: t,
      strategy: "riga",
    });
  }
  return finalize({
    firstName,
    lastName,
    missiveCode: cleanCode(code),
    activity: cleanActivity(activity),
    confidence: {
      firstName: confidenceFor(firstName, line),
      lastName: confidenceFor(lastName, line),
      missiveCode: confidenceFor(code, line),
      activity: confidenceFor(activity, line),
    },
    source: t,
    strategy: "riga",
  });
}

// ---------------------------------------------------------------- 4. schede multi-riga
function looksLikeName(t: string): boolean {
  const c = cleanText(t);
  if (/\d/.test(c)) return false;
  const parts = c.split(" ").filter(Boolean);
  return parts.length >= 2 && parts.length <= 4 && parts.every((p) => /^\p{Lu}[\p{L}'.-]*$/u.test(p));
}

function parseCards(lines: OcrLine[]): ParsedContact[] {
  const out: ParsedContact[] = [];
  let cur: { name?: OcrLine; code?: { v: string; l: OcrLine }; activity?: OcrLine } | null = null;
  const flush = () => {
    if (!cur?.name) {
      cur = null;
      return;
    }
    const { firstName, lastName } = splitFullName(cur.name.text);
    out.push(
      finalize({
        firstName,
        lastName,
        missiveCode: cur.code ? cleanCode(cur.code.v) : "",
        activity: cur.activity ? cleanActivity(cur.activity.text) : "",
        confidence: {
          firstName: cur.name.confidence,
          lastName: cur.name.confidence,
          missiveCode: cur.code ? confidenceFor(cur.code.v, cur.code.l) : 0,
          activity: cur.activity ? cur.activity.confidence : 0,
        },
        source: [cur.name.text, cur.code?.l.text, cur.activity?.text].filter(Boolean).map((s) => cleanText(s!)).join(" / "),
        strategy: "scheda",
      }),
    );
    cur = null;
  };
  for (const line of lines) {
    const t = cleanText(line.text);
    if (isNoise(t)) continue;
    const codeOnly = t.match(/^(?:cod(?:ice)?\.?\s*(?:missiva)?\s*[:#]?\s*|#\s*|n[°º.]\s*)?((?:[A-Z]{1,4}[-\s]?)?\d[\d\-./]{2,}[A-Z0-9]*)$/i);
    if (looksLikeName(t) && (!cur || cur.code || cur.activity)) {
      flush();
      cur = { name: line };
    } else if (cur && codeOnly && !cur.code) {
      cur.code = { v: codeOnly[1], l: line };
    } else if (cur && !cur.activity && !/\d{3,}/.test(t)) {
      cur.activity = line;
    }
  }
  flush();
  return out;
}

/** Punto di ingresso: restituisce i contatti candidati, da verificare a mano */
export function parseContactsFromOcr(lines: OcrLine[]): ParsedContact[] {
  const clean = lines.filter((l) => l.text && l.text.trim());
  const kv = parseKeyValue(clean);
  if (kv) return kv;
  const table = parseTable(clean);
  if (table) return table;
  const free = clean.map(parseFreeLine).filter((p): p is ParsedContact => p !== null);
  if (free.length > 0) return free;
  return parseCards(clean);
}

/** Converte testo semplice in righe (per test e per incollare testo copiato) */
export function linesFromPlainText(text: string, confidence = 90): OcrLine[] {
  return text.split(/\r?\n/).map((t) => {
    let x = 0;
    const words: OcrWord[] = [];
    for (const m of t.matchAll(/\S+/g)) {
      x = m.index ?? x;
      words.push({ text: m[0], confidence, x0: x * 10, x1: (x + m[0].length) * 10 });
    }
    return { text: t, confidence, words };
  });
}
