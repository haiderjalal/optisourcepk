import { cn } from "@/lib/utils";

/**
 * Labelled form control.
 *
 * Wires the label, the error message and `aria-describedby` together in one
 * place so every back-office form is announced correctly without each one
 * having to remember how.
 */

export const inputClass =
  "border-mist-300 focus:border-accent-600 aria-[invalid=true]:border-amber-400 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors disabled:bg-mist-100 disabled:text-navy-400";

export function Field({
  name,
  label,
  hint,
  errors,
  required,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  className?: string;
  /** Receives the props the control must carry. */
  children: (props: {
    id: string;
    name: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
    className: string;
    required?: boolean;
  }) => React.ReactNode;
}) {
  const error = errors?.[0];
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={name}
        className="text-navy-600 mb-1.5 block text-sm font-medium"
      >
        {label}
        {required && (
          <span className="text-amber-600" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>

      {children({
        id: name,
        name,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        className: inputClass,
        required,
      })}

      {hint && !error && (
        <p id={hintId} className="text-navy-400 mt-1.5 text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-amber-700">
          {error}
        </p>
      )}
    </div>
  );
}
