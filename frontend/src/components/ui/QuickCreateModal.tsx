"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { Modal } from "./Modal";
import { Field, Input } from "./Field";
import { Button } from "./Button";

/** The legacy app's "fast-track" pattern: pick an existing record, or type a
 * new name and it gets created inline without leaving the current form. */
export function QuickCreateModal({
  open,
  onClose,
  title,
  label,
  placeholder,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  label: string;
  placeholder?: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onCreate(name);
      setName("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={label} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder={placeholder} />
        </Field>
        {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
