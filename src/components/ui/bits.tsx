import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABEL } from "@/lib/labels";
import type { PaymentState } from "@/lib/money";

export function Ornament({ className = "" }: { className?: string }) {
  return <hr className={`rule my-4 ${className}`} aria-hidden />;
}

/** Fregio tipografico per titoli */
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 16" className={`mx-auto h-3.5 w-48 text-current ${className}`} aria-hidden fill="none" stroke="currentColor">
      <path d="M2 8h78M140 8h78" strokeWidth="1" />
      <path d="M80 8c8-7 16-7 22 0c-6 7-14 7-22 0zM140 8c-8-7-16-7-22 0c6 7 14 7 22 0z" strokeWidth="1" />
      <path d="M110 2l6 6-6 6-6-6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PageHeader({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker && <p className="font-heading text-sm tracking-[0.2em] text-brass-light uppercase">{kicker}</p>}
        <h1 className="carved font-display text-3xl sm:text-4xl">{title}</h1>
      </div>
      {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

const STATUS_STAMP: Partial<Record<OrderStatus, string>> = {
  IN_LAVORAZIONE: "text-sepia",
  PRONTO: "text-olive",
  CONSEGNATO: "text-ink",
  ANNULLATO: "text-bordeaux",
};

/** Timbro grafico per stato ordine / saldo */
export function Stamp({ children, tone = "text-bordeaux", animate, className = "" }: { children: React.ReactNode; tone?: string; animate?: boolean; className?: string }) {
  return <span className={`stamp ${tone} ${animate ? "stamp-in" : ""} ${className}`}>{children}</span>;
}

export function StatusStamp({ status, animate }: { status: OrderStatus; animate?: boolean }) {
  const tone = STATUS_STAMP[status];
  if (!tone) return null;
  return (
    <Stamp tone={tone} animate={animate}>
      {ORDER_STATUS_LABEL[status]}
    </Stamp>
  );
}

export function StatusLabel({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    RICEVUTO: "bg-parchment-light text-ink border-ink/40",
    IN_ATTESA: "bg-paper-old text-ink border-ink/40",
    IN_LAVORAZIONE: "bg-sepia text-parchment-light border-ink/60",
    PRONTO: "bg-olive text-parchment-light border-ink/60",
    CONSEGNATO: "bg-ink text-parchment border-ink",
    ANNULLATO: "bg-bordeaux text-parchment-light border-ink/60",
  };
  return (
    <span className={`inline-block rounded-[2px] border px-2 py-0.5 font-heading text-[0.85rem] leading-tight ${colors[status]}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentLabel({ state }: { state: PaymentState }) {
  const map: Record<PaymentState, [string, string]> = {
    NON_PAGATO: ["Non pagato", "text-bordeaux border-bordeaux/60"],
    PARZIALE: ["Parzialmente pagato", "text-sepia border-sepia/70"],
    PAGATO: ["Pagato", "text-olive border-olive/70"],
  };
  const [label, cls] = map[state];
  return <span className={`inline-block border-b-2 font-heading text-[0.9rem] leading-tight ${cls}`}>{label}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="paper frame sheet-in mx-auto max-w-xl px-6 py-10 text-center">
      <p className="font-display text-2xl text-ink-soft">{title}</p>
      <Flourish className="my-3 text-sepia" />
      {children && <div className="font-fell text-lg italic text-ink-soft">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Caricamento…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <svg viewBox="0 0 24 24" className="h-5 w-5 animate-[spin-slow_1.4s_linear_infinite]" aria-hidden>
        {/* ruota di carro */}
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1="12" y1="2.5" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.3" transform={`rotate(${a} 12 12)`} />
        ))}
      </svg>
      <span className="font-fell italic">{label}</span>
    </span>
  );
}

/** Inclinazione deterministica per i fogli della bacheca */
export function tiltFor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const deg = ((Math.abs(h) % 25) - 12) / 10; // da -1.2° a +1.2°
  return `${deg}deg`;
}
