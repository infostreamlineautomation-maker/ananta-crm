"use client";

import { CustomFieldDefinition } from "@/lib/types";
import { Field, Input, Select } from "@/components/ui/Field";

interface DynamicFormFieldsProps {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export function DynamicFormFields({ fields, values, onChange }: DynamicFormFieldsProps) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 pt-3 border-t border-border">
      <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint">
        Custom Attributes / Extra Fields
      </h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const val = values?.[f.field_key] ?? f.default_value ?? "";

          if (f.field_type === "boolean") {
            return (
              <div key={f.id} className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => onChange(f.field_key, e.target.checked)}
                    className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                  />
                  {f.label}
                  {f.is_required && <span className="text-rose-500">*</span>}
                </label>
              </div>
            );
          }

          if (f.field_type === "select") {
            return (
              <Field key={f.id} label={f.label} required={f.is_required}>
                <Select
                  value={String(val)}
                  onChange={(e) => onChange(f.field_key, e.target.value)}
                >
                  <option value="">Select {f.label}...</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          }

          if (f.field_type === "date") {
            return (
              <Field key={f.id} label={f.label} required={f.is_required}>
                <Input
                  type="date"
                  value={String(val)}
                  onChange={(e) => onChange(f.field_key, e.target.value)}
                  required={f.is_required}
                />
              </Field>
            );
          }

          if (f.field_type === "number") {
            return (
              <Field key={f.id} label={f.label} required={f.is_required}>
                <Input
                  type="number"
                  step="any"
                  value={String(val)}
                  onChange={(e) => onChange(f.field_key, e.target.value)}
                  placeholder={`Enter ${f.label.toLowerCase()}...`}
                  required={f.is_required}
                />
              </Field>
            );
          }

          return (
            <Field key={f.id} label={f.label} required={f.is_required}>
              <Input
                type="text"
                value={String(val)}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                placeholder={`Enter ${f.label.toLowerCase()}...`}
                required={f.is_required}
              />
            </Field>
          );
        })}
      </div>
    </div>
  );
}
