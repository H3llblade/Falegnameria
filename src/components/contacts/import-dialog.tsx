"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, FileUp, ImageUp, Plus, ScanText, Trash2 } from "lucide-react";
import { checkDuplicatesAction, importContactsAction } from "@/app/actions/contacts";
import { contactSchema } from "@/lib/validation/schemas";
import { parseCsv, type DupMatch } from "@/lib/contacts";
import { FIELDS, LOW_CONFIDENCE, linesFromPlainText, parseContactsFromOcr, type Field } from "@/lib/ocr/parser";
import { Modal } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/bits";
import { useActionToast } from "@/components/ui/toast";

type Row = {
  key: number;
  include: boolean;
  firstName: string;
  lastName: string;
  missiveCode: string;
  activity: string;
  city: string;
  confidence: Partial<Record<Field, number>>;
  warnings: string[];
  dups: DupMatch[];
  source?: string;
};

const LABELS: Record<Field, string> = { firstName: "Nome", lastName: "Cognome", missiveCode: "Codice missiva", activity: "Attività" };

let keySeq = 1;
const blankRow = (): Row => ({
  key: keySeq++,
  include: true,
  firstName: "",
  lastName: "",
  missiveCode: "",
  activity: "",
  city: "",
  confidence: {},
  warnings: [],
  dups: [],
});

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ink" onClick={() => setOpen(true)}>
        <ScanText size={18} aria-hidden /> Importa da immagine
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Importazione contatti" wide>
        {open && <ImportFlow onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

type Step = "input" | "ocr" | "review";

function ImportFlow({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const toast = useActionToast();
  const [tab, setTab] = useState<"image" | "text">("image");
  const [step, setStep] = useState<Step>("input");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ status: string; progress: number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rawText, setRawText] = useState("");
  const [source, setSource] = useState<"ocr" | "csv">("ocr");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const checkDups = useCallback(async (list: Row[]) => {
    setChecking(true);
    const r = await checkDuplicatesAction(list.map((x) => ({ firstName: x.firstName, lastName: x.lastName, missiveCode: x.missiveCode })));
    setChecking(false);
    if (!r.ok) return list;
    // Duplicati anche all'interno dello stesso lotto
    const seen = new Map<string, number>();
    return list.map((x, i) => {
      const dups = [...(r.data?.[i] ?? [])];
      const k = x.missiveCode.trim().toUpperCase();
      if (k && seen.has(k)) dups.push({ id: "", reason: "codice", label: `riga ${seen.get(k)! + 1} di questa importazione` });
      else if (k) seen.set(k, i);
      return { ...x, dups, include: x.include && dups.length === 0 };
    });
  }, []);

  const toReview = useCallback(
    async (parsed: Row[], src: "ocr" | "csv") => {
      setSource(src);
      setRows(await checkDups(parsed.length ? parsed : [blankRow()]));
      setStep("review");
    },
    [checkDups],
  );

  const handleImage = useCallback(
    async (file: Blob) => {
      setError(null);
      const { validateImage, preprocess, recognize } = await import("@/lib/ocr/run-ocr");
      let bmp: ImageBitmap;
      try {
        bmp = await validateImage(file);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
      setStep("ocr");
      setProgress({ status: "preparazione", progress: 0 });
      try {
        const canvas = preprocess(bmp);
        bmp.close();
        const lines = await recognize(canvas, setProgress);
        setRawText(lines.map((l) => l.text).join("\n"));
        const parsed = parseContactsFromOcr(lines).map((p) => ({ ...blankRow(), ...p, city: "", dups: [] }));
        if (parsed.length === 0) setError("Nessun contatto riconosciuto con certezza: è possibile inserirli a mano qui sotto.");
        await toReview(parsed, "ocr");
      } catch (e) {
        console.error(e);
        setError("Il riconoscimento del testo non è riuscito. È possibile inserire i dati manualmente.");
        await toReview([], "ocr");
      } finally {
        setProgress(null);
      }
    },
    [toReview],
  );

  // CTRL+V / CMD+V ovunque nella finestra
  useEffect(() => {
    if (step !== "input" || tab !== "image") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
      if (item) {
        e.preventDefault();
        const f = item.getAsFile();
        if (f) handleImage(f);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [step, tab, handleImage]);

  const pasteFromClipboardButton = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const t = it.types.find((x) => x.startsWith("image/"));
        if (t) return handleImage(await it.getType(t));
      }
      setError("Negli appunti non c'è un'immagine. Copiate uno screenshot e premete CTRL+V.");
    } catch {
      setError("Il browser non consente la lettura diretta degli appunti: premete CTRL+V (CMD+V su Mac).");
    }
  };

  const parseText = (text: string) => {
    const t = text.trim();
    if (!t) return setError("Incollare del testo o un CSV.");
    setError(null);
    const csv = parseCsv(t);
    const header = csv[0]?.map((h) => h.toLowerCase()) ?? [];
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iFn = idx(/^nome$/), iLn = idx(/cognome/), iCode = idx(/codice|missiva/), iAct = idx(/attivit|descr|mestiere/), iCity = idx(/citt/);
    if (csv.length > 1 && iFn >= 0 && iLn >= 0 && iCode >= 0) {
      const parsed = csv.slice(1).map((r) => ({
        ...blankRow(),
        firstName: r[iFn] ?? "",
        lastName: r[iLn] ?? "",
        missiveCode: (r[iCode] ?? "").replace(/^'/, ""),
        activity: iAct >= 0 ? (r[iAct] ?? "") : "",
        city: iCity >= 0 ? (r[iCity] ?? "") : "",
        confidence: { firstName: 100, lastName: 100, missiveCode: 100, activity: 100 },
      }));
      return toReview(parsed, "csv");
    }
    const parsed = parseContactsFromOcr(linesFromPlainText(t)).map((p) => ({ ...blankRow(), ...p, city: "", dups: [] }));
    if (parsed.length === 0) setError("Nessun contatto riconosciuto: correggere il testo o inserire le righe a mano.");
    toReview(parsed, "csv");
  };

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        // un campo corretto a mano diventa affidabile
        for (const f of FIELDS) if (f in patch) next.confidence = { ...next.confidence, [f]: 100 };
        return next;
      }),
    );

  const validity = rows.map((r) => contactSchema.safeParse(r));
  const selected = rows.filter((r, i) => r.include && validity[i].success);
  const invalidSelected = rows.filter((r, i) => r.include && !validity[i].success).length;

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    const r = await importContactsAction(
      { rows: selected.map(({ firstName, lastName, missiveCode, activity, city }) => ({ firstName, lastName, missiveCode, activity, city, notes: "" })) },
      source,
    );
    setSaving(false);
    if (r.ok) {
      toast({ ok: true, message: `${r.data!.count} contatti importati in rubrica` });
      router.refresh();
      onDone();
    } else toast(r);
  };

  // ------------------------------------------------------------------ UI
  if (step === "ocr")
    return (
      <div className="grid gap-5 md:grid-cols-2">
        {preview && <img src={preview} alt="Screenshot da analizzare" className="max-h-80 w-full border-4 border-parchment-light object-contain shadow" />}
        <div className="flex flex-col justify-center gap-3">
          <Spinner label="Lettura del documento in corso…" />
          <div className="h-3 w-full overflow-hidden rounded-sm border border-ink/40 bg-parchment-light" role="progressbar" aria-valuenow={Math.round((progress?.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-sepia transition-[width]" style={{ width: `${Math.round((progress?.progress ?? 0) * 100)}%` }} />
          </div>
          <p className="font-fell text-sm italic text-ink-soft">
            Fase: {translateStatus(progress?.status)}. Il riconoscimento avviene nel browser: lo screenshot non viene inviato al server.
            Al primo utilizzo vengono scaricati i dizionari della lingua (alcuni MB).
          </p>
        </div>
      </div>
    );

  if (step === "review")
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          {preview && source === "ocr" && <img src={preview} alt="Screenshot analizzato" className="max-h-40 border-4 border-parchment-light object-contain shadow" />}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-heading">Verificate e correggete i dati prima di salvarli.</p>
            <p className="font-fell italic text-ink-soft">
              I campi evidenziati hanno una lettura incerta. Nulla viene salvato finché non confermate. Le righe con possibili duplicati sono
              deselezionate.
            </p>
            {error && (
              <p className="font-fell italic text-bordeaux" role="alert">
                {error}
              </p>
            )}
            {checking && <Spinner label="Controllo duplicati…" />}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ledger min-w-[56rem]">
            <thead>
              <tr>
                <th className="w-10">
                  <span className="sr-only">Importa</span>✓
                </th>
                {FIELDS.map((f) => (
                  <th key={f}>
                    {LABELS[f]} <span className="text-bordeaux">*</span>
                  </th>
                ))}
                <th>Città</th>
                <th>
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const v = validity[i];
                const issues = v.success ? {} : Object.fromEntries(v.error.issues.map((x) => [x.path[0], x.message]));
                return (
                  <tr key={r.key} className={r.include ? "" : "opacity-60"}>
                    <td>
                      <input type="checkbox" className="mt-2 h-5 w-5 accent-[#596044]" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} aria-label={`Importa riga ${i + 1}`} />
                    </td>
                    {FIELDS.map((f) => {
                      const conf = r.confidence[f] ?? 0;
                      const low = conf < LOW_CONFIDENCE;
                      return (
                        <td key={f}>
                          <input
                            className={`input !min-h-[2.2rem] !py-1 !text-base ${f === "missiveCode" ? "num" : ""} ${low ? "!border-sepia !bg-[#f3dfb8]" : ""}`}
                            value={r[f]}
                            aria-label={`${LABELS[f]} riga ${i + 1}`}
                            aria-invalid={r.include && issues[f] ? true : undefined}
                            onChange={(e) => update(r.key, { [f]: e.target.value })}
                          />
                          {low && (
                            <span className="mt-0.5 flex items-center gap-1 font-fell text-xs italic text-sepia">
                              <AlertTriangle size={11} aria-hidden /> {r[f] ? `lettura incerta (${conf}%)` : "non letto"}
                            </span>
                          )}
                          {r.include && issues[f] && <span className="block font-fell text-xs italic text-bordeaux">{issues[f]}</span>}
                        </td>
                      );
                    })}
                    <td>
                      <input className="input !min-h-[2.2rem] !py-1 !text-base" value={r.city} aria-label={`Città riga ${i + 1}`} onChange={(e) => update(r.key, { city: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm text-bordeaux" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Elimina riga ${i + 1}`}>
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.map((r) =>
                r.dups.length ? (
                  <tr key={`d${r.key}`} className="!bg-transparent">
                    <td />
                    <td colSpan={6} className="!pt-0 font-fell text-sm italic text-bordeaux">
                      {r.firstName} {r.lastName}: possibile duplicato di {r.dups.map((d) => `${d.label} (${d.reason})`).join(", ")}
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>

        {rawText && (
          <details className="text-[0.95rem]">
            <summary className="cursor-pointer font-heading text-sepia">Testo letto dall&apos;immagine (per verifica)</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border border-ink/20 bg-parchment-light p-2 font-type text-sm">{rawText}</pre>
          </details>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-paper btn-sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>
              <Plus size={15} aria-hidden /> Aggiungi riga a mano
            </button>
            <button type="button" className="btn btn-paper btn-sm" disabled={checking} onClick={async () => setRows(await checkDups(rows.map((r) => ({ ...r, include: true }))))}>
              Ricontrolla duplicati
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setStep("input");
                setRows([]);
                setError(null);
              }}
            >
              Ricomincia
            </button>
          </div>
          <div className="flex items-center gap-3">
            {invalidSelected > 0 && <span className="font-fell text-sm italic text-bordeaux">{invalidSelected} righe selezionate incomplete</span>}
            <button type="button" className="btn btn-olive" disabled={saving || selected.length === 0 || invalidSelected > 0} onClick={save}>
              {saving ? "Salvataggio…" : `Conferma e salva ${selected.length} contatti`}
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "image"} className={`btn btn-sm ${tab === "image" ? "btn-ink" : "btn-paper"}`} onClick={() => setTab("image")}>
          <ImageUp size={15} aria-hidden /> Da screenshot
        </button>
        <button type="button" role="tab" aria-selected={tab === "text"} className={`btn btn-sm ${tab === "text" ? "btn-ink" : "btn-paper"}`} onClick={() => setTab("text")}>
          <FileUp size={15} aria-hidden /> Da CSV o testo
        </button>
      </div>
      {error && (
        <p className="mb-3 border-l-4 border-bordeaux bg-bordeaux/10 px-3 py-2 font-fell italic text-bordeaux" role="alert">
          {error}
        </p>
      )}
      {tab === "image" ? (
        <div
          ref={dropRef}
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            dropRef.current?.classList.add("!border-brass", "!bg-brass/15");
          }}
          onDragLeave={() => dropRef.current?.classList.remove("!border-brass", "!bg-brass/15")}
          onDrop={(e) => {
            e.preventDefault();
            dropRef.current?.classList.remove("!border-brass", "!bg-brass/15");
            const f = e.dataTransfer.files?.[0];
            if (f) handleImage(f);
          }}
          className="flex flex-col items-center justify-center gap-3 rounded-[3px] border-2 border-dashed border-ink/50 bg-parchment-light/60 px-6 py-12 text-center"
          aria-label="Area di incolla o trascinamento dello screenshot"
        >
          <ClipboardPaste size={40} strokeWidth={1.3} className="text-sepia" aria-hidden />
          <p className="font-display text-xl">Incollate qui lo screenshot</p>
          <p className="font-fell italic text-ink-soft">
            Premete <kbd className="num rounded border border-ink/40 px-1">CTRL</kbd>+<kbd className="num rounded border border-ink/40 px-1">V</kbd> (o{" "}
            <kbd className="num rounded border border-ink/40 px-1">⌘</kbd>+<kbd className="num rounded border border-ink/40 px-1">V</kbd>), trascinate un&apos;immagine
            oppure sceglietela dal dispositivo.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="btn btn-brass cursor-pointer">
              <ImageUp size={17} aria-hidden /> Scegli immagine
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
            </label>
            <button type="button" className="btn btn-paper" onClick={pasteFromClipboardButton}>
              <ClipboardPaste size={17} aria-hidden /> Leggi dagli appunti
            </button>
          </div>
          <p className="font-fell text-sm italic text-ink-soft">PNG, JPEG o WebP · massimo 10 MB</p>
          <button type="button" className="font-fell text-sm italic text-sepia underline" onClick={() => toReview([], "ocr")}>
            oppure inserite i contatti manualmente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-fell italic text-ink-soft">
            Incollate un CSV con intestazione (Nome; Cognome; Codice missiva; Attività; Città) oppure righe di testo libero come «Mario Rossi – 00123 –
            Fabbro».
          </p>
          <textarea className="input min-h-48 font-type !text-sm" value={rawText} onChange={(e) => setRawText(e.target.value)} aria-label="Testo o CSV da importare" />
          <div className="flex flex-wrap justify-between gap-2">
            <label className="btn btn-paper btn-sm cursor-pointer">
              <FileUp size={15} aria-hidden /> Carica file CSV
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) return setError("File troppo grande (max 2 MB)");
                  setRawText((await f.text()).replace(/^﻿/, ""));
                }}
              />
            </label>
            <button type="button" className="btn btn-ink" onClick={() => parseText(rawText)}>
              Analizza
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function translateStatus(s?: string): string {
  if (!s) return "avvio";
  if (s.includes("loading tesseract core")) return "caricamento del motore";
  if (s.includes("loading language")) return "caricamento dizionari";
  if (s.includes("initializ")) return "inizializzazione";
  if (s.includes("recognizing")) return "lettura del testo";
  if (s === "preparazione") return "preparazione dell'immagine";
  return s;
}
