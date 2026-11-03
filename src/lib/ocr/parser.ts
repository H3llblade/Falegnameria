/**
 * Parser verificabile del testo OCR → contatti.
 * Non inventa dati: un campo non leggibile resta vuoto e viene segnalato come incerto.
 *
 * Strategie (in ordine):
 *  1. Blocchi "chiave: valore" (Nome: …, Codice missiva: …, Attività: …)
 *  2. Tabella con riga di intestazione: le colonne si ricavano dalle coordinate X delle parole
 *  3. Righe libere "Nome Cognome – 01234 – Attività" (separatori | ; – - tab o spazi multipli)
 *  4. Schede su più righe (nome / codice / attività su righe consecutive)
 */

export type OcrWord = { text: string; confidence: number; x0: number; x1: number };
export type OcrLine = { text: string; confidence: number; words: OcrWord[] };

export type Field = "name" | "missiveCode" | "activity";
export const FIELDS: Field[] = ["name", "missiveCode", "activity"];

export type ParsedContact = {
  name: string;
  missiveCode: string;
  activity: string;
  confidence: Record<Field, number>;
  warnings: string[];
  source: string;
  strategy: "chiave-valore" | "tabella" | "riga" | "scheda";
};

export const LOW_CONFIDENCE = 75;

const KEY_PATTERNS: [RegExp, Field | "firstName" | "lastName" | "ignore"][] = [
  [/^(nome\s*(e|&)\s*cognome|nominativo|nome\s*contatto|contatto)$/i, "name"],
  [/^(cognome|surname|last\s*name)$/i, "lastName"],
  [/^(nome|name|first\s*name)$/i, "firstName"],
  [/^(cod(ice)?\.?\s*(missiva|telegramma|postale)?|missiva|telegramma|n[°º.]?\s*missiva|id|codice\s*id|p\.?o\.?\s*box)$/i, "missiveCode"],
  [/^(attivit[aà]|descrizione(\s*attivit[aà])?|mestiere|professione|occupazione|ruolo|impiego|nota|note)$/i, "activity"],
  [/^(citt[aà]|luogo|residenza|contea|gruppo|rispondi)$/i, "ignore"],
];

type Key = Field | "firstName" | "lastName" | "ignore";

function keyOf(label: string): Key | null {
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

/** Testo segnaposto dei giochi (es. "Aggiungi nota…"): non è un dato */
const PLACEHOLDER_RE = /^(aggiungi|add)\s+(nota|note)\b/i;

const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G", "|": "I" };
const TO_DIGIT: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", "|": "1", "/": "7", S: "5", B: "8", Z: "2", G: "6", T: "7" };

/**
 * Codici in formato "2 lettere + 3 cifre" (es. KA343): corregge gli scambi tipici dell'OCR
 * (0/O, 1/I, 7 letto come "/") in base alla posizione. Altri formati restano invariati.
 */
export function fixMissiveCode(raw: string): { code: string; corrected: boolean } {
  const c = raw.toUpperCase();
  if (c.length !== 5) return { code: raw, corrected: false };
  // serve almeno una lettera vera all'inizio e due cifre vere alla fine (00123 resta così)
  if (!/[A-Z]/.test(c.slice(0, 2)) || (c.slice(2).match(/\d/g)?.length ?? 0) < 2) return { code: raw, corrected: false };
  const letters = [...c.slice(0, 2)].map((ch) => (/[A-Z]/.test(ch) ? ch : TO_LETTER[ch]));
  const digits = [...c.slice(2)].map((ch) => (/\d/.test(ch) ? ch : TO_DIGIT[ch]));
  if (letters.some((x) => !x) || digits.some((x) => !x)) return { code: raw, corrected: false };
  const code = letters.join("") + digits.join("");
  return { code, corrected: code !== c };
}

function cleanCode(s: string): string {
  const c = cleanText(s).replace(/^[#:\s]+/, "").replace(/[\s,;|]+$/g, "").replace(/\s+/g, "");
  return fixMissiveCode(c).code;
}

function cleanActivity(s: string): string {
  const a = cleanText(s).replace(/^[\s\-–—|:;,]+|[\s\-–—|:;,]+$/g, "");
  return PLACEHOLDER_RE.test(a) ? "" : a;
}

/** Nome e cognome in un unico campo ("Rossi, Mario" → "Mario Rossi") */
function joinName(first: string, last: string): string {
  return [cleanName(first), cleanName(last)].filter(Boolean).join(" ");
}

function fullName(s: string): string {
  const f = cleanText(s);
  if (f.includes(",")) {
    const [last, first] = f.split(",", 2);
    return joinName(first, last);
  }
  return cleanName(f);
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
  else if (!/^[A-Z]{2}\d{3}$/.test(p.missiveCode) && /[OoIl|]/.test(p.missiveCode) && /\d/.test(p.missiveCode)) {
    warnings.push("Il codice contiene lettere simili a cifre (O/0, I/1): verificare");
    confidence.missiveCode = Math.min(confidence.missiveCode, LOW_CONFIDENCE - 1);
  }
  if (!p.name) warnings.push("Nome mancante");
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
    const parts = [cur.firstName, cur.lastName].filter((x) => x);
    const name = cur.name ? fullName(cur.name.v) : joinName(cur.firstName?.v ?? "", cur.lastName?.v ?? "");
    const conf: Partial<Record<Field, number>> = {
      name: cur.name?.c ?? (parts.length ? Math.min(...parts.map((x) => x.c)) : 0),
      missiveCode: cur.missiveCode?.c,
      activity: cur.activity?.c,
    };
    out.push(
      finalize({
        name,
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
type Column = { field: Key; x: number };

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
    const rec: Partial<Record<Key, string>> = {};
    const conf: Partial<Record<Key, number>> = {};
    cols.forEach((c, i) => {
      if (c.field === "ignore") return;
      rec[c.field] = buckets[i].text.join(" ").trim();
      conf[c.field] = avg(buckets[i].conf);
    });
    const name = rec.name !== undefined ? fullName(rec.name) : joinName(rec.firstName ?? "", rec.lastName ?? "");
    if (!name && !rec.missiveCode) continue;
    const nameConf = rec.name !== undefined ? conf.name : Math.min(conf.firstName ?? 100, conf.lastName ?? 100);
    out.push(
      finalize({
        name,
        missiveCode: cleanCode(rec.missiveCode ?? ""),
        activity: cleanActivity(rec.activity ?? ""),
        confidence: { name: nameConf, missiveCode: conf.missiveCode, activity: conf.activity },
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
  const name = fullName(namePart);
  const words = name.split(" ");
  // Righe senza separatori: "Mario Rossi Fabbro 0123" → nome = prime 2 parole
  if (segs.length === 1 && !cleanActivity(after) && words.length > 2) {
    const n = words.slice(0, 2).join(" ");
    activity = words.slice(2).join(" ");
    return finalize({
      name: n,
      missiveCode: cleanCode(code),
      activity: cleanActivity(activity),
      confidence: {
        name: Math.min(confidenceFor(n, line), LOW_CONFIDENCE - 1), // separazione nome/attività incerta
        missiveCode: confidenceFor(code, line),
        activity: Math.min(confidenceFor(activity, line), LOW_CONFIDENCE - 1),
      },
      source: t,
      strategy: "riga",
    });
  }
  return finalize({
    name,
    missiveCode: cleanCode(code),
    activity: cleanActivity(activity),
    confidence: {
      name: confidenceFor(name, line),
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
    out.push(
      finalize({
        name: fullName(cur.name.text),
        missiveCode: cur.code ? cleanCode(cur.code.v) : "",
        activity: cur.activity ? cleanActivity(cur.activity.text) : "",
        confidence: {
          name: cur.name.confidence,
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
