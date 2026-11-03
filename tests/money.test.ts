import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, parseMoneyToCents, paymentState } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12,50", 1250],
    ["12.50", 1250],
    ["0,05", 5],
    ["1.250", 125000],
    ["1.250,75", 125075],
    ["1,250.75", 125075],
    ["$ 30", 3000],
    ["  7,00 ", 700],
    ["1.234.567", 123456700],
  ])("%s → %i", (input, cents) => expect(parseMoneyToCents(input)).toBe(cents));

  it.each(["", "abc", "1,234,5x", "12,345", "1.2.3,4,5"])("rifiuta %s", (input) => {
    expect(() => parseMoneyToCents(input)).toThrow();
  });

  it("nessun errore di arrotondamento", () => {
    expect(parseMoneyToCents("0,10") + parseMoneyToCents("0,20")).toBe(30);
  });
});

describe("formattazione", () => {
  it("formatCents", () => {
    expect(formatCents(125075)).toBe("$ 1.250,75");
    expect(formatCents(5)).toBe("$ 0,05");
    expect(formatCents(-300)).toBe("−$ 3,00");
  });
  it("centsToInput", () => expect(centsToInput(1250)).toBe("12,50"));
});

describe("paymentState", () => {
  it("deriva lo stato dagli importi", () => {
    expect(paymentState(1000, 0)).toBe("NON_PAGATO");
    expect(paymentState(1000, 400)).toBe("PARZIALE");
    expect(paymentState(1000, 1000)).toBe("PAGATO");
  });
});
