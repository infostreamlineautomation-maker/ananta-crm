import clsx from "clsx";
import { ChevronDown } from "lucide-react";

const inputClasses =
  "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-surface-sunken disabled:text-ink-faint";

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-primary-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[12px] text-ink-faint">{hint}</p>}
      {error && <p className="mt-1 text-[12px] font-medium text-primary-600">{error}</p>}
    </div>
  );
}

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={clsx(inputClasses, props.className)} />
);

export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} rows={props.rows ?? 3} className={clsx(inputClasses, "h-auto resize-none py-2", props.className)} />
);

export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select {...props} className={clsx(inputClasses, "appearance-none pr-9", props.className)}>
      {props.children}
    </select>
    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
  </div>
);

export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{title}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
