"use client";

import { useState } from "react";
import { Building2, Upload, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Company, Country } from "@/lib/types";
import { mediaUrl } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Field, FieldGroup, Input, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";

export interface CompanyFormProps {
  company?: Company | null;
  countries: Country[];
  onCancel: () => void;
  onSaved: (company?: Company) => void;
}

export function CompanyForm({
  company,
  countries,
  onCancel,
  onSaved,
}: CompanyFormProps) {
  const toast = useToast();
  const [form, setForm] = useState({
    company_name: company?.company_name ?? "",
    contact_name: company?.contact_name ?? "",
    gstin: company?.gstin || company?.vat_id || "",
    msin_number: company?.msin_number ?? "",
    vat_id: company?.gstin || company?.vat_id || "",
    reg_no: company?.reg_no ?? "",
    contact_email: company?.contact_email ?? "",
    contact_phone: company?.contact_phone ?? "",
    company_phone: company?.company_phone ?? "",
    country: company?.country ?? ("" as string | number),
    state: company?.state ?? "",
    city: company?.city ?? "",
    zip_code: company?.zip_code ?? "",
    address: company?.address ?? "",
    facebook: company?.facebook ?? "",
    twitter: company?.twitter ?? "",
    linkedin: company?.linkedin ?? "",
    remarks: company?.remarks ?? "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name, sublabel: c.currency_code }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v ?? "")));
      if (logoFile) body.append("logo", logoFile);

      if (company) {
        const updated = await apiFetch<Company>(`/api/companies/${company.id}/`, { method: "PATCH", body });
        toast.success("Company updated.");
        onSaved(updated);
      } else {
        const created = await apiFetch<Company>("/api/companies/", { method: "POST", body });
        toast.success("Company added.");
        onSaved(created);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this company.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup title="Basic Info">
        <Field label="Company Name" required className="sm:col-span-2">
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} required autoFocus />
        </Field>
        <Field label="Contact Name">
          <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Registration">
        <Field label="GSTIN">
          <Input
            value={form.gstin}
            onChange={(e) => {
              set("gstin", e.target.value);
              set("vat_id", e.target.value);
            }}
            placeholder="e.g. 24ABCDE1234F1Z5"
          />
        </Field>
        <Field label="MSIN Number">
          <Input
            value={form.msin_number}
            onChange={(e) => set("msin_number", e.target.value)}
            placeholder="e.g. MSIN123456"
          />
        </Field>
        <Field label="Registration No.">
          <Input value={form.reg_no} onChange={(e) => set("reg_no", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Contact">
        <Field label="Contact Email">
          <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
        </Field>
        <Field label="Contact Phone">
          <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        </Field>
        <Field label="Company Phone">
          <Input value={form.company_phone} onChange={(e) => set("company_phone", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Address">
        <Field label="Country">
          <Combobox
            value={form.country || null}
            onChange={(v) => set("country", v)}
            options={countryOptions}
            placeholder="Select country..."
          />
        </Field>
        <Field label="State">
          <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Zip Code">
          <Input value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Social Links">
        <Field label="Facebook">
          <Input value={form.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="https://facebook.com/..." />
        </Field>
        <Field label="Twitter">
          <Input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="https://x.com/..." />
        </Field>
        <Field label="LinkedIn" className="sm:col-span-2">
          <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/company/..." />
        </Field>
      </FieldGroup>

      <FieldGroup title="Branding">
        <Field label="Logo" className="sm:col-span-2">
          <div className="flex items-center gap-3">
            {mediaUrl(company?.logo) && !logoFile ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, dynamic remote URL
              <img src={mediaUrl(company?.logo)!} alt="" width={44} height={44} className="h-11 w-11 rounded-md border border-border object-cover" />
            ) : logoFile ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: preview URL, next/image can't render these
              <img src={URL.createObjectURL(logoFile)} alt="" width={44} height={44} className="h-11 w-11 rounded-md border border-border object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-border-strong text-ink-faint">
                <Building2 className="h-4.5 w-4.5" />
              </div>
            )}
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 text-[13px] font-semibold text-ink hover:bg-surface-hover">
              <Upload className="h-3.5 w-3.5" />
              Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </label>
            {logoFile && (
              <button
                type="button"
                onClick={() => setLogoFile(null)}
                className="text-xs text-ink-muted hover:text-primary-600 flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" /> Remove selected
              </button>
            )}
          </div>
        </Field>
      </FieldGroup>

      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
      </Field>

      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save Company
        </Button>
      </div>
    </form>
  );
}
