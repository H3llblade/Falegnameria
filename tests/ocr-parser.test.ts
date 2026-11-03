import { describe, expect, it } from "vitest";
import { fixMissiveCode, linesFromPlainText, parseContactsFromOcr, type OcrLine } from "@/lib/ocr/parser";

const parse = (t: string) => parseContactsFromOcr(linesFromPlainText(t));

describe("parser OCR", () => {
  it("righe libere con separatori", () => {
    const r = parse("Mario Rossi - 00123 - Fabbro\nAnna Bianchi | 4567 | Allevatrice di cavalli\n\nRumore ##");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ name: "Mario Rossi", missiveCode: "00123", activity: "Fabbro" });
    expect(r[1]).toMatchObject({ name: "Anna Bianchi", missiveCode: "4567", activity: "Allevatrice di cavalli" });
  });

  it("conserva gli zeri iniziali del codice", () => {
    expect(parse("Luigi Verdi 000789 Cacciatore")[0].missiveCode).toBe("000789");
  });

  it("blocchi chiave: valore, più contatti", () => {
    const r = parse(
      "Nome: John\nCognome: Marston\nCodice missiva: 0451\nAttività: Allevatore\nNome: Sadie\nCognome: Adler\nCodice missiva: 7781\nAttività: Cacciatrice di taglie",
    );
    expect(r).toHaveLength(2);
    expect(r[1]).toMatchObject({ name: "Sadie Adler", missiveCode: "7781", activity: "Cacciatrice di taglie" });
    expect(r[0].strategy).toBe("chiave-valore");
  });

  it("tabella con intestazione (colonne da coordinate X)", () => {
    const mk = (cells: [string, number][]): OcrLine => ({
      text: cells.map((c) => c[0]).join(" "),
      confidence: 88,
      words: cells.flatMap(([t, x]) =>
        t.split(" ").map((w, i) => ({ text: w, confidence: 88, x0: x + i * 60, x1: x + i * 60 + 50 })),
      ),
    });
    const lines = [
      mk([["Nome", 0], ["Cognome", 200], ["Codice missiva", 400], ["Attività", 650]]),
      mk([["Arthur", 0], ["Morgan", 200], ["01234", 400], ["Mandriano", 650]]),
      mk([["Mary", 0], ["Linton", 200], ["9876", 400], ["Commerciante di stoffe", 650]]),
    ];
    const r = parseContactsFromOcr(lines);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ name: "Arthur Morgan", missiveCode: "01234", activity: "Mandriano" });
    expect(r[1].activity).toBe("Commerciante di stoffe");
    expect(r[0].strategy).toBe("tabella");
  });

  it("schede su più righe", () => {
    const r = parse("Hosea Matthews\n#5521\nTruffatore di professione\nJavier Escuella\n3310\nPistolero");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ name: "Hosea Matthews", missiveCode: "5521", activity: "Truffatore di professione" });
  });

  it("segnala campi mancanti o incerti, senza inventare", () => {
    const r = parse("Nome: Bill\nCodice missiva: 12O4");
    expect(r[0].name).toBe("Bill");
    expect(r[0].activity).toBe("");
    expect(r[0].confidence.activity).toBe(0);
    expect(r[0].confidence.missiveCode).toBeLessThan(75);
  });

  it("testo senza contatti → nessun risultato", () => {
    expect(parse("Benvenuti a Valentine\n---")).toHaveLength(0);
  });

  it("codici 2 lettere + 3 cifre: corregge gli scambi tipici dell'OCR", () => {
    expect(fixMissiveCode("IQ/64").code).toBe("IQ764");
    expect(fixMissiveCode("W1327").code).toBe("WI327");
    expect(fixMissiveCode("HO944").code).toBe("HO944");
    expect(fixMissiveCode("0I266").code).toBe("OI266");
    expect(fixMissiveCode("CC5O3").code).toBe("CC503");
    expect(fixMissiveCode("00123")).toEqual({ code: "00123", corrected: false }); // formato diverso: invariato
  });

  it("rubrica telegrammi (Nome contatto / Codice / Nota / Gruppo)", () => {
    const mk = (cells: [string, number][]): OcrLine => ({
      text: cells.map((c) => c[0]).join(" "),
      confidence: 88,
      words: cells.flatMap(([t, x]) => t.split(" ").map((w, i) => ({ text: w, confidence: 88, x0: x + i * 60, x1: x + i * 60 + 50 }))),
    });
    const lines = [
      mk([["IL TUO CODICE POSTALE KA343", 600]]),
      mk([["NOME CONTATTO", 0], ["CODICE", 300], ["NOTA", 500], ["GRUPPO", 800], ["RISPONDI", 1000]]),
      mk([["Tony Chesterfield", 20], ["UN936", 300], ["Carpentiere Blackwater", 500], ["—", 800]]),
      mk([["Edmund Hardgrave", 20], ["IQ/64", 300], ["Aggiungi nota...", 500], ["Lavoro", 800]]),
    ];
    const r = parseContactsFromOcr(lines);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ name: "Tony Chesterfield", missiveCode: "UN936", activity: "Carpentiere Blackwater" });
    expect(r[1]).toMatchObject({ name: "Edmund Hardgrave", missiveCode: "IQ764", activity: "" });
  });
});
