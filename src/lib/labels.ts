import type {
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  OrderStatus,
} from "@prisma/client";

export const ORDER_STATUSES: OrderStatus[] = [
  "RICEVUTO",
  "IN_ATTESA",
  "IN_LAVORAZIONE",
  "PRONTO",
  "CONSEGNATO",
  "ANNULLATO",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RICEVUTO: "Ricevuto",
  IN_ATTESA: "In attesa",
  IN_LAVORAZIONE: "In lavorazione",
  PRONTO: "Pronto",
  CONSEGNATO: "Consegnato",
  ANNULLATO: "Annullato",
};

/** Stati considerati "commessa aperta" */
export const OPEN_STATUSES: OrderStatus[] = ["RICEVUTO", "IN_ATTESA", "IN_LAVORAZIONE", "PRONTO"];
/** Solo gli ordini chiusi possono essere archiviati */
export const ARCHIVABLE_STATUSES: OrderStatus[] = ["CONSEGNATO", "ANNULLATO"];

export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  "AVVISO",
  "COMUNICAZIONE",
  "OFFERTA",
  "RICERCA_MATERIALI",
  "ANNUNCIO_COMMERCIALE",
  "ALTRO",
];

export const ANNOUNCEMENT_CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  AVVISO: "Avviso",
  COMUNICAZIONE: "Comunicazione",
  OFFERTA: "Offerta",
  RICERCA_MATERIALI: "Ricerca materiali",
  ANNUNCIO_COMMERCIALE: "Annuncio commerciale",
  ALTRO: "Altro",
};

export const ANNOUNCEMENT_PRIORITIES: AnnouncementPriority[] = ["BASSA", "NORMALE", "ALTA", "URGENTE"];

export const ANNOUNCEMENT_PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  BASSA: "Bassa",
  NORMALE: "Normale",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const ANNOUNCEMENT_STATUS_LABEL: Record<AnnouncementStatus, string> = {
  BOZZA: "Bozza",
  PUBBLICATO: "Pubblicato",
};

export const DEFAULT_RECIPE_CATEGORIES = [
  "Mobili",
  "Tavoli",
  "Sedie",
  "Armadi",
  "Porte",
  "Finestre",
  "Carri",
  "Decorazioni",
  "Riparazioni",
  "Altre lavorazioni",
];

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: tz() }).format(
    new Date(d),
  );
}

export function formatDateShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz() }).format(
    new Date(d),
  );
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz(),
  }).format(new Date(d));
}

export function tz(): string {
  return process.env.NEXT_PUBLIC_TIMEZONE || "Europe/Rome";
}

/** "2026-11-03" per <input type="date"> */
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(d),
  );
  return parts;
}

export function orderNumber(n: number): string {
  return `N° ${String(n).padStart(4, "0")}`;
}
