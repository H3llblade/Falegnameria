import type { PrismaClient } from "@prisma/client";
import { OPEN_STATUSES, tz } from "@/lib/labels";

export type Period = "oggi" | "7g" | "mese" | "totale" | "custom";

export const PERIOD_LABEL: Record<Period, string> = {
  oggi: "Oggi",
  "7g": "Ultimi 7 giorni",
  mese: "Mese corrente",
  totale: "Totale storico",
  custom: "Intervallo personalizzato",
};

/** Mezzanotte locale (fuso configurato) espressa come Date UTC */
function startOfLocalDay(d: Date): Date {
  const zone = tz();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return zonedMidnight(ymd, zone);
}

function zonedMidnight(ymd: string, zone: string): Date {
  const guess = new Date(`${ymd}T00:00:00Z`);
  const offsetMs = tzOffsetMs(guess, zone);
  return new Date(guess.getTime() - offsetMs);
}

function tzOffsetMs(date: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

export function periodRange(period: Period, from?: string, to?: string, now = new Date()): { gte?: Date; lt?: Date } {
  const zone = tz();
  switch (period) {
    case "oggi":
      return { gte: startOfLocalDay(now) };
    case "7g": {
      const start = startOfLocalDay(now);
      return { gte: new Date(start.getTime() - 6 * 86400_000) };
    }
    case "mese": {
      const ym = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit" }).format(now);
      return { gte: zonedMidnight(`${ym}-01`, zone) };
    }
    case "custom": {
      const r: { gte?: Date; lt?: Date } = {};
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) r.gte = zonedMidnight(from, zone);
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) r.lt = new Date(zonedMidnight(to, zone).getTime() + 86400_000);
      return r;
    }
    default:
      return {};
  }
}

export async function getSummary(db: PrismaClient, period: Period, from?: string, to?: string) {
  const range = periodRange(period, from, to);
  const [notCancelled, collected, open, inWork] = await Promise.all([
    // Da riscuotere: situazione attuale, indipendente dal periodo
    db.order.aggregate({ where: { status: { not: "ANNULLATO" } }, _sum: { totalCents: true, paidCents: true } }),
    db.payment.aggregate({
      where: { voidedAt: null, ...(range.gte || range.lt ? { paidAt: range } : {}) },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.order.aggregate({ where: { status: { in: OPEN_STATUSES } }, _sum: { totalCents: true }, _count: true }),
    db.order.count({ where: { status: "IN_LAVORAZIONE" } }),
  ]);
  return {
    toCollectCents: (notCancelled._sum.totalCents ?? 0) - (notCancelled._sum.paidCents ?? 0),
    collectedCents: collected._sum.amountCents ?? 0,
    collectedCount: collected._count,
    openValueCents: open._sum.totalCents ?? 0,
    openCount: open._count,
    inWorkCount: inWork,
  };
}
