"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { Product } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { DynamicFormFields } from "@/components/custom-fields/DynamicFormFields";

export interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
  product?: Product | null;
  title?: string;
}

export function ProductModal({
  open,
  onClose,
  onSaved,
  product = null,
  title,
}: ProductModalProps) {
  const toast = useToast();
  const [name, setName] = useState(product?.product_name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [extraData, setExtraData] = useState<Record<string, any>>(product?.extra_data || {});
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(product?.product_name ?? "");
      setDescription(product?.description ?? "");
      setExtraData(product?.extra_data || {});
      setError(null);

      apiFetch<Paginated<any>>("/api/custom-fields/?module=product")
        .then((res) => setCustomFields(res.results || []))
        .catch(() => {});
    }
  }, [open, product]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { product_name: name.trim(), description: description.trim(), extra_data: extraData };
      let savedProduct: Product;
      if (product) {
        savedProduct = await apiFetch<Product>(`/api/products/${product.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Product updated.");
      } else {
        savedProduct = await apiFetch<Product>("/api/products/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Product added to catalog.");
      }
      onSaved(savedProduct);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || (product ? "Edit Product" : "Add New Product")}
      width="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Product Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Premium Vinyl Wrap"
            required
            autoFocus
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Product specifications, materials, dimensions..."
            rows={3}
          />
        </Field>

        {customFields.length > 0 && (
          <DynamicFormFields
            fields={customFields}
            values={extraData}
            onChange={(k, v) => setExtraData((prev) => ({ ...prev, [k]: v }))}
          />
        )}

        {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {product ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
