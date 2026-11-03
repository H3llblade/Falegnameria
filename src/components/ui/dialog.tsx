"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/** Finestra modale accessibile basata su <dialog> nativo (focus trap ed Esc inclusi) */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`paper frame ledger-open m-auto max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto p-0 ${wide ? "max-w-5xl" : "max-w-lg"}`}
      aria-labelledby="dlg-title"
    >
      {open && (
        <div className="p-5 sm:p-7">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="dlg-title" className="font-display text-xl text-ink sm:text-2xl">
              {title}
            </h2>
            <button className="btn btn-ghost btn-sm -mr-2 -mt-1" onClick={onClose} aria-label="Chiudi">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

type ConfirmOpts = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Se presente l'utente deve digitare questo testo per confermare */
  typeToConfirm?: string;
  /** Campo di testo obbligatorio (es. motivo) */
  reasonLabel?: string;
};
type ConfirmResult = { confirmed: boolean; text: string };

const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<ConfirmResult>>(async () => ({ confirmed: false, text: "" }));

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (r: ConfirmResult) => void }) | null>(null);
  const [text, setText] = useState("");
  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<ConfirmResult>((resolve) => {
        setText("");
        setState({ ...o, resolve });
      }),
    [],
  );
  const close = (confirmed: boolean) => {
    state?.resolve({ confirmed, text });
    setState(null);
  };
  const needsText = state?.typeToConfirm ?? state?.reasonLabel;
  const canConfirm = !state
    ? false
    : state.typeToConfirm
      ? text.trim() === state.typeToConfirm
      : state.reasonLabel
        ? text.trim().length >= 3
        : true;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ""}>
        {state && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canConfirm) close(true);
            }}
          >
            {state.body && <div className="mb-4 text-[1.02rem] leading-relaxed">{state.body}</div>}
            {needsText && (
              <label className="mb-4 block">
                <span className="field-label">
                  {state.typeToConfirm ? (
                    <>
                      Digitare <strong className="num text-bordeaux">{state.typeToConfirm}</strong> per confermare
                    </>
                  ) : (
                    state.reasonLabel
                  )}
                </span>
                <input autoFocus className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
              </label>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-paper" onClick={() => close(false)} autoFocus={!needsText}>
                Annulla
              </button>
              <button type="submit" className={`btn ${state.danger ? "btn-bordeaux" : "btn-ink"}`} disabled={!canConfirm}>
                {state.confirmLabel ?? "Conferma"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmCtx);
}
