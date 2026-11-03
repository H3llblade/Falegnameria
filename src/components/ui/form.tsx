"use client";

import { forwardRef } from "react";
import type { FieldError } from "react-hook-form";

export function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  error?: FieldError | { message?: string } | string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const msg = typeof error === "string" ? error : error?.message;
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {required && (
          <span className="text-bordeaux" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {msg ? (
        <p id={htmlFor ? `${htmlFor}-err` : undefined} className="mt-1 font-fell text-[0.95rem] italic text-bordeaux" role="alert">
          {msg}
        </p>
      ) : hint ? (
        <p className="mt-1 font-fell text-[0.92rem] italic text-ink-soft/80">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className = "", id, ...rest }, ref) {
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-err` : undefined}
      className={`input ${className}`}
      {...rest}
    />
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className = "", id, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-err` : undefined}
      className={`input min-h-24 resize-y leading-relaxed ${className}`}
      {...rest}
    />
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className = "", children, ...rest }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={`input cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
});

/** Applica gli errori di campo restituiti dal server al modulo RHF */
export function applyServerErrors(
  fieldErrors: Record<string, string> | undefined,
  setError: (name: never, e: { type: string; message: string }) => void,
) {
  if (!fieldErrors) return;
  for (const [k, v] of Object.entries(fieldErrors)) setError(k as never, { type: "server", message: v });
}
