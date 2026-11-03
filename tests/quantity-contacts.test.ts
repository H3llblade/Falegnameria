import { describe, expect, it } from "vitest";
import { scaleMaterials, sumMaterials, parseQuantityToMilli } from "@/lib/quantity";
import { csvCell, findDuplicates, indexLetter, parseCsv, sortContacts } from "@/lib/contacts";

describe("materiali", () => {
  it("4 assi × 5 unità = 20 assi", () => {
    const [m] = scaleMaterials([{ name: "Assi di legno", quantity: "4", unit: "pz" }], 5);
    expect(m.total).toBe("20");
    expect(m.totalMilli).toBe(20000);
  });
  it("decimali esatti", () => {
    const [m] = scaleMaterials([{ name: "Vernice", quantity: "0,1", unit: "l" }], 3);
    expect(m.total).toBe("0,3");
  });
  it("somma per nome+unità", () => {
    const a = scaleMaterials([{ name: "Chiodi", quantity: "10", unit: "pz" }], 2);
    const b = scaleMaterials([{ name: "chiodi", quantity: "5", unit: "pz" }], 1);
    expect(sumMaterials([a, b])[0].total).toBe("25");
  });
  it("rifiuta quantità non valide", () => expect(() => parseQuantityToMilli("1,2345")).toThrow());
});

describe("rubrica", () => {
  it("ordinamento italiano per cognome poi nome, case-insensitive", () => {
    const sorted = sortContacts([
      { firstName: "Luca", lastName: "zanetti" },
      { firstName: "Anna", lastName: "Èrcole" },
      { firstName: "Bruno", lastName: "Rossi" },
      { firstName: "Aldo", lastName: "rossi" },
      { firstName: "Carla", lastName: "D'Angelo" },
    ]);
    expect(sorted.map((c) => `${c.lastName} ${c.firstName}`)).toEqual([
      "D'Angelo Carla",
      "Èrcole Anna",
      "rossi Aldo",
      "Rossi Bruno",
      "zanetti Luca",
    ]);
  });
  it("lettera indice", () => {
    expect(indexLetter("Èrcole")).toBe("E");
    expect(indexLetter("123")).toBe("#");
  });
  it("duplicati per codice e per nome", () => {
    const existing = [
      { id: "1", firstName: "Mario", lastName: "Rossi", missiveCode: "00123" },
      { id: "2", firstName: "Anna", lastName: "Bianchi", missiveCode: "555" },
    ];
    expect(findDuplicates({ firstName: "X", lastName: "Y", missiveCode: "#00123" }, existing)[0].reason).toBe("codice");
    expect(findDuplicates({ firstName: "anna", lastName: "BIANCHI", missiveCode: "9" }, existing)[0].reason).toBe("nome");
    expect(findDuplicates({ firstName: "Anna", lastName: "Verdi", missiveCode: "0123" }, existing)).toHaveLength(0);
  });
  it("CSV: protezione formule e parsing", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('a;"b"')).toBe('"a;""b"""');
    expect(parseCsv('Nome;Cognome\n"Mario";"Ros;si"\n')).toEqual([["Nome", "Cognome"], ["Mario", "Ros;si"]]);
  });
});
