"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { AppSettings, ExchangeRate } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

import { mediaUrl } from "@/lib/format";
import { useOrganization } from "@/lib/organization-context";
import { CustomFieldsManager } from "@/components/custom-fields/CustomFieldsManager";
import { LoadingState } from "@/components/ui/LoadingState";

const TABS = [
  { key: "general", label: "General" },
  { key: "company", label: "Company Info" },
  { key: "quotation", label: "Quotation Defaults" },
  { key: "custom_fields", label: "Custom Fields & Columns" },
  { key: "email", label: "Email & SMTP Server" },
  { key: "whatsapp", label: "WhatsApp & Messaging" },
  { key: "currency", label: "Currency & Forex Rates" },
];


export default function SettingsPage() {
  const toast = useToast();
  const { refresh: refreshOrg } = useOrganization();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    apiFetch<AppSettings>("/api/settings/")
      .then((s) => {
        setSettings(s);
        setForm({
          app_name: s.app_name || "",
          company_name: s.company_name || s.app_name || "",
          company_email: s.company_email || "",
          company_phone: s.company_phone || "",
          company_address: s.company_address || "",
          default_currency_code: s.default_currency_code || "INR",
          default_tax_percent: s.default_tax_percent || "0",
          order_prefix: s.order_prefix || "AG/",
          quotation_prefix: s.quotation_prefix || "AG/",
          quotation_intro: s.quotation_intro || "",
          quotation_terms: s.quotation_terms || "",
          quotation_signature_name: s.quotation_signature_name || "",
          quotation_designation: s.quotation_designation || "",
          quotation_contact_person: s.quotation_contact_person || "",
          smtp_host: s.smtp_host || "",
          smtp_port: s.smtp_port ? String(s.smtp_port) : "587",
          smtp_user: s.smtp_user || "",
          smtp_password: s.smtp_password || "",
          smtp_use_tls: s.smtp_use_tls !== undefined ? String(s.smtp_use_tls) : "true",
          smtp_use_ssl: s.smtp_use_ssl !== undefined ? String(s.smtp_use_ssl) : "false",
          smtp_from_email: s.smtp_from_email || "",
          smtp_from_name: s.smtp_from_name || "",
          notify_admin_email: s.notify_admin_email || "",
          notify_on_new_order: s.notify_on_new_order !== undefined ? String(s.notify_on_new_order) : "true",
          notify_on_order_delivered: s.notify_on_order_delivered !== undefined ? String(s.notify_on_order_delivered) : "false",
          notify_on_quote_accepted: s.notify_on_quote_accepted !== undefined ? String(s.notify_on_quote_accepted) : "true",
          notify_on_payment_received: s.notify_on_payment_received !== undefined ? String(s.notify_on_payment_received) : "true",
          whatsapp_number: s.whatsapp_number || "",
          whatsapp_default_country_code: s.whatsapp_default_country_code || "+91",
          whatsapp_order_template: s.whatsapp_order_template || "",
          whatsapp_quote_template: s.whatsapp_quote_template || "",
          whatsapp_payment_template: s.whatsapp_payment_template || "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          body.append(k, v);
        }
      });
      if (form.app_name) {
        body.append("name", form.app_name);
      }
      if (form.company_email) {
        body.append("contact_email", form.company_email);
      }
      if (form.company_phone) {
        body.append("contact_phone", form.company_phone);
      }
      if (form.company_address) {
        body.append("address", form.company_address);
      }

      Object.entries(files).forEach(([k, f]) => {
        if (f) {
          body.append(k, f);
          if (k === "app_logo") {
            body.append("logo", f);
          }
        }
      });

      const updated = await apiFetch<AppSettings>("/api/settings/", { method: "PATCH", body });
      setSettings(updated);
      setFiles({});
      try {
        await refreshOrg();
      } catch {
        // ignore refresh errors
      }
      toast.success("Settings saved.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState size="lg" label="Loading Organization Settings..." sublabel="Fetching configuration & preferences" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        action={
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save Settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Card className="flex flex-col gap-1 p-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "rounded-md border-l-[3px] px-3 py-2 text-left text-[13.5px] font-semibold transition-colors",
                tab === t.key ? "border-primary-500 bg-primary-50 text-primary-600" : "border-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          {tab === "general" && (
            <>
              <Field label="App Name">
                <Input value={form.app_name ?? ""} onChange={(e) => set("app_name", e.target.value)} />
              </Field>
              <FileField label="App Logo" current={settings?.app_logo} file={files.app_logo} onChange={(f) => setFiles((s) => ({ ...s, app_logo: f }))} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Default Currency Code" hint="3-letter code, e.g. INR.">
                  <Input value={form.default_currency_code ?? ""} onChange={(e) => set("default_currency_code", e.target.value.toUpperCase())} maxLength={3} />
                </Field>
                <Field label="Default Tax %">
                  <Input type="number" step="0.01" value={form.default_tax_percent ?? ""} onChange={(e) => set("default_tax_percent", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {tab === "company" && (
            <>
              <Field label="Company Name">
                <Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Company Email">
                  <Input type="email" value={form.company_email ?? ""} onChange={(e) => set("company_email", e.target.value)} />
                </Field>
                <Field label="Company Phone">
                  <Input value={form.company_phone ?? ""} onChange={(e) => set("company_phone", e.target.value)} />
                </Field>
              </div>
              <Field label="Company Address">
                <Textarea value={form.company_address ?? ""} onChange={(e) => set("company_address", e.target.value)} />
              </Field>
            </>
          )}

          {tab === "quotation" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Project / Order Number Prefix" hint="e.g. AG/ produces AG/001-26">
                  <Input value={form.order_prefix ?? ""} onChange={(e) => set("order_prefix", e.target.value)} className="max-w-[160px] font-mono font-bold" />
                </Field>
                <Field label="Quotation Number Prefix" hint="e.g. AG/ produces AG/001-26">
                  <Input value={form.quotation_prefix ?? ""} onChange={(e) => set("quotation_prefix", e.target.value)} className="max-w-[160px] font-mono font-bold" />
                </Field>
              </div>
              <Field label="Intro Text">
                <Textarea value={form.quotation_intro ?? ""} onChange={(e) => set("quotation_intro", e.target.value)} />
              </Field>
              <Field label="Terms Text">
                <Textarea value={form.quotation_terms ?? ""} onChange={(e) => set("quotation_terms", e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Signature Name">
                  <Input value={form.quotation_signature_name ?? ""} onChange={(e) => set("quotation_signature_name", e.target.value)} />
                </Field>
                <Field label="Designation">
                  <Input value={form.quotation_designation ?? ""} onChange={(e) => set("quotation_designation", e.target.value)} />
                </Field>
                <Field label="Contact Person">
                  <Input value={form.quotation_contact_person ?? ""} onChange={(e) => set("quotation_contact_person", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FileField
                  label="Background Image"
                  current={settings?.quotation_background_image}
                  file={files.quotation_background_image}
                  onChange={(f) => setFiles((s) => ({ ...s, quotation_background_image: f }))}
                />
                <FileField
                  label="Signature Image"
                  current={settings?.quotation_signature_image}
                  file={files.quotation_signature_image}
                  onChange={(f) => setFiles((s) => ({ ...s, quotation_signature_image: f }))}
                />
              </div>
            </>
          )}

          {tab === "custom_fields" && <CustomFieldsManager />}

          {tab === "email" && (

            <>
              <div className="rounded-lg bg-primary-50/50 p-4 border border-primary-100 mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">SMTP Email Server</h4>
                <p className="text-xs text-ink-muted mt-0.5">
                  Configure your SMTP credentials (Gmail, Outlook, Amazon SES, SendGrid, or custom mail server) to dispatch official invoices, order updates, and quotation proposals directly to clients.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="SMTP Host / Server" hint="e.g. smtp.gmail.com, smtp.office365.com">
                  <Input value={form.smtp_host ?? ""} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
                </Field>
                <Field label="SMTP Port" hint="587 for TLS / STARTTLS, 465 for SSL">
                  <Input type="number" value={form.smtp_port ?? "587"} onChange={(e) => set("smtp_port", e.target.value)} placeholder="587" />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="SMTP Username / Email" hint="Your email account login">
                  <Input value={form.smtp_user ?? ""} onChange={(e) => set("smtp_user", e.target.value)} placeholder="billing@yourdomain.com" />
                </Field>
                <Field label="SMTP Password / App Password" hint="For Gmail, use a 16-character App Password">
                  <Input type="password" value={form.smtp_password ?? ""} onChange={(e) => set("smtp_password", e.target.value)} placeholder="••••••••••••" />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Default Sender Name" hint="e.g. Ananta Graphics">
                  <Input value={form.smtp_from_name ?? ""} onChange={(e) => set("smtp_from_name", e.target.value)} placeholder="Ananta Graphics" />
                </Field>
                <Field label="From Email Address" hint="Must match your SMTP Login account, or have 'Send As' rights (e.g. sales@yourdomain.com)">
                  <Input type="email" value={form.smtp_from_email ?? ""} onChange={(e) => set("smtp_from_email", e.target.value)} placeholder="sales@yourdomain.com" />
                </Field>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.smtp_use_tls === "true" || form.smtp_use_tls === "1"}
                    onChange={(e) => set("smtp_use_tls", e.target.checked ? "true" : "false")}
                    className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                  />
                  Use TLS / STARTTLS (Recommended for Port 587)
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.smtp_use_ssl === "true" || form.smtp_use_ssl === "1"}
                    onChange={(e) => set("smtp_use_ssl", e.target.checked ? "true" : "false")}
                    className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                  />
                  Use SSL (For Port 465)
                </label>
              </div>

              {/* Test Connection Box */}
              <div className="mt-4 rounded-lg border border-border bg-surface-sunken/40 p-4">
                <h5 className="text-xs font-bold text-ink">Test SMTP Connection</h5>
                <p className="text-[11.5px] text-ink-muted mt-0.5">
                  Save your settings first, then enter an email address below to send a test verification email.
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2 max-w-md">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter recipient email to test..."
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={testingEmail}
                    onClick={async () => {
                      if (!testEmail.trim()) {
                        toast.error("Enter a recipient email to test.");
                        return;
                      }
                      setTestingEmail(true);
                      try {
                        const res = await apiFetch<{ detail: string }>("/api/settings/test-email/", {
                          method: "POST",
                          body: JSON.stringify({ recipient_email: testEmail.trim() }),
                        });
                        toast.success(res.detail || "Test email sent successfully!");
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : "SMTP connection failed.");
                      } finally {
                        setTestingEmail(false);
                      }
                    }}
                    className="whitespace-nowrap text-xs font-semibold"
                  >
                    Send Test Email
                  </Button>
                </div>
              </div>

              {/* Admin Email Notifications & Alert Preferences */}
              <div className="mt-6 pt-6 border-t border-border">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-ink">Automated Admin Email Alerts</h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Receive instant, automated emails at your admin address when critical business events occur in the CRM.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                  <Field
                    label="Admin Alert Recipient Email"
                    hint="Where alert emails should be delivered (defaults to company email if blank)"
                  >
                    <Input
                      type="email"
                      value={form.notify_admin_email ?? ""}
                      onChange={(e) => set("notify_admin_email", e.target.value)}
                      placeholder="admin@yourcompany.com"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-sunken/40 p-3.5 hover:bg-surface-sunken transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.notify_on_new_order === "true" || form.notify_on_new_order === "1"}
                      onChange={(e) => set("notify_on_new_order", e.target.checked ? "true" : "false")}
                      className="mt-0.5 h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink block">New Order Booked</span>
                      <span className="text-[11.5px] text-ink-muted leading-relaxed">
                        Alert admin whenever staff or sales reps create a new order with order value and client details.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-sunken/40 p-3.5 hover:bg-surface-sunken transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.notify_on_quote_accepted === "true" || form.notify_on_quote_accepted === "1"}
                      onChange={(e) => set("notify_on_quote_accepted", e.target.checked ? "true" : "false")}
                      className="mt-0.5 h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink block">Quotation Accepted (Won Deal)</span>
                      <span className="text-[11.5px] text-ink-muted leading-relaxed">
                        Alert admin immediately when a client proposal is accepted and ready to be converted into an order.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-sunken/40 p-3.5 hover:bg-surface-sunken transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.notify_on_payment_received === "true" || form.notify_on_payment_received === "1"}
                      onChange={(e) => set("notify_on_payment_received", e.target.checked ? "true" : "false")}
                      className="mt-0.5 h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink block">Payment Received / Paid Order</span>
                      <span className="text-[11.5px] text-ink-muted leading-relaxed">
                        Alert admin when orders are marked as Paid or Partial by the accounts team.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-sunken/40 p-3.5 hover:bg-surface-sunken transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.notify_on_order_delivered === "true" || form.notify_on_order_delivered === "1"}
                      onChange={(e) => set("notify_on_order_delivered", e.target.checked ? "true" : "false")}
                      className="mt-0.5 h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink block">Order Delivered</span>
                      <span className="text-[11.5px] text-ink-muted leading-relaxed">
                        Alert admin when production and logistics team marks an order as delivered.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {tab === "whatsapp" && (
            <>
              <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
                <div>
                  <h4 className="text-sm font-bold text-ink">WhatsApp Messaging & 1-Click Dispatch Configuration</h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Configure your business WhatsApp identity, default international dialing prefix, and custom message templates.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active 1-Click Integration
                </span>
              </div>

              {/* Business Number & Country Code */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Official WhatsApp Business Number"
                  hint="Your company WhatsApp number (e.g. +91 98765 43210)"
                >
                  <Input
                    value={form.whatsapp_number ?? ""}
                    onChange={(e) => set("whatsapp_number", e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </Field>

                <Field
                  label="Default Country Dial Code"
                  hint="Automatically applied when client phone has no country code (e.g. +91 for India, +971 for UAE, +1 for US)"
                >
                  <Input
                    value={form.whatsapp_default_country_code ?? "+91"}
                    onChange={(e) => set("whatsapp_default_country_code", e.target.value)}
                    placeholder="+91"
                  />
                </Field>
              </div>

              {/* Template Customization */}
              <div className="mt-6 pt-6 border-t border-border flex flex-col gap-5">
                <div>
                  <h4 className="text-sm font-bold text-ink">Default WhatsApp Message Templates</h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Customize the default messages generated when staff clicks "Send on WhatsApp". Leave blank to use system smart defaults.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-mono text-ink-muted bg-surface-sunken p-2.5 rounded-lg border border-border/60">
                    <span className="font-sans font-bold text-ink mr-1">Supported Tags:</span>
                    <code className="bg-white px-1.5 py-0.5 rounded border border-border text-primary-600">{"{client_name}"}</code>
                    <code className="bg-white px-1.5 py-0.5 rounded border border-border text-primary-600">{"{order_no}"}</code>
                    <code className="bg-white px-1.5 py-0.5 rounded border border-border text-primary-600">{"{quote_no}"}</code>
                    <code className="bg-white px-1.5 py-0.5 rounded border border-border text-primary-600">{"{amount}"}</code>
                    <code className="bg-white px-1.5 py-0.5 rounded border border-border text-primary-600">{"{invoice_url}"}</code>
                    <code className="bg-white px-1.5 py-0.5 rounded border border-border text-primary-600">{"{date}"}</code>
                  </div>
                </div>

                <Field
                  label="Order Confirmation & Bill Template (Optional Override)"
                  hint="Message sent when an order is created or when staff sends order bill"
                >
                  <Textarea
                    rows={4}
                    value={form.whatsapp_order_template ?? ""}
                    onChange={(e) => set("whatsapp_order_template", e.target.value)}
                    placeholder="*Dear {client_name},*&#10;&#10;Thank you for your order! Your order *{order_no}* for *{amount}* has been confirmed.&#10;&#10;View your Tax Invoice: {invoice_url}&#10;&#10;_Thank you for choosing us!_"
                    className="font-mono text-xs leading-relaxed"
                  />
                </Field>

                <Field
                  label="Quotation & Proposal Template (Optional Override)"
                  hint="Message sent when sharing a quotation or proposal with a prospective client"
                >
                  <Textarea
                    rows={4}
                    value={form.whatsapp_quote_template ?? ""}
                    onChange={(e) => set("whatsapp_quote_template", e.target.value)}
                    placeholder="*Dear {client_name},*&#10;&#10;Please find our quotation *{quote_no}* for *{amount}*.&#10;&#10;Review the full estimate here: {invoice_url}&#10;&#10;Looking forward to your feedback!"
                    className="font-mono text-xs leading-relaxed"
                  />
                </Field>

                <Field
                  label="Payment Reminder Template (Optional Override)"
                  hint="Message sent when reminding clients about pending invoice balances"
                >
                  <Textarea
                    rows={4}
                    value={form.whatsapp_payment_template ?? ""}
                    onChange={(e) => set("whatsapp_payment_template", e.target.value)}
                    placeholder="*Dear {client_name},*&#10;&#10;Friendly reminder regarding the pending payment of *{amount}* for Order *{order_no}*.&#10;&#10;Review your bill: {invoice_url}&#10;&#10;Kindly confirm once processed. Thank you!"
                    className="font-mono text-xs leading-relaxed"
                  />
                </Field>
              </div>

              {/* Live Test WhatsApp Launcher */}
              <div className="mt-4 rounded-lg border border-border bg-emerald-50/40 p-4">
                <h5 className="text-xs font-bold text-emerald-900">Test WhatsApp Web Launcher</h5>
                <p className="text-[11.5px] text-emerald-700 mt-0.5">
                  Enter a test phone number with country code to test opening WhatsApp with a sample CRM message.
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2 max-w-md">
                  <Input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="text-xs bg-white"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!testPhone.trim()) {
                        toast.error("Enter a test phone number first.");
                        return;
                      }
                      const clean = testPhone.replace(/[^\d]/g, "");
                      const text = encodeURIComponent("Hello! This is a test message from Ananta CRM.");
                      window.open(`https://wa.me/${clean}?text=${text}`, "_blank", "noopener,noreferrer");
                      toast.success("Opened WhatsApp test chat!");
                    }}
                    className="whitespace-nowrap text-xs font-semibold text-emerald-800 bg-white border-emerald-300 hover:bg-emerald-100"
                  >
                    Test WhatsApp Link
                  </Button>
                </div>
              </div>
            </>
          )}

          {tab === "currency" && (
            <CurrencyRatesManager
              baseCurrency={form.default_currency_code || "INR"}
              onBaseCurrencyChange={(c) => set("default_currency_code", c)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function CurrencyRatesManager({
  baseCurrency,
  onBaseCurrencyChange,
}: {
  baseCurrency: string;
  onBaseCurrencyChange: (c: string) => void;
}) {
  const toast = useToast();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [savingCurrency, setSavingCurrency] = useState<string | null>(null);

  const loadRates = async () => {
    try {
      const data = await apiFetch<ExchangeRate[]>("/api/exchange-rates/");
      setRates(data);
      const initVals: Record<string, string> = {};
      data.forEach((r) => {
        initVals[r.source_currency] = String(r.rate);
      });
      setEditingValues(initVals);
    } catch {
      toast.error("Couldn't load exchange rates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch<{ message: string; rates: ExchangeRate[] }>("/api/exchange-rates/sync/", {
        method: "POST",
      });
      setRates(res.rates || []);
      const initVals: Record<string, string> = {};
      (res.rates || []).forEach((r) => {
        initVals[r.source_currency] = String(r.rate);
      });
      setEditingValues(initVals);
      toast.success(res.message || "Live forex rates refreshed.");
    } catch {
      toast.error("Failed to sync live forex rates.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveOverride = async (sourceCurrency: string) => {
    const val = editingValues[sourceCurrency];
    if (!val || isNaN(Number(val)) || Number(val) <= 0) {
      toast.error("Please enter a valid positive exchange rate.");
      return;
    }
    setSavingCurrency(sourceCurrency);
    try {
      const updated = await apiFetch<ExchangeRate>("/api/exchange-rates/override/", {
        method: "POST",
        body: JSON.stringify({
          source_currency: sourceCurrency,
          rate: val,
        }),
      });
      setRates((prev) => prev.map((r) => (r.source_currency === sourceCurrency ? updated : r)));
      toast.success(`Custom rate saved for 1 ${sourceCurrency} = ${val} ${baseCurrency}.`);
    } catch {
      toast.error("Couldn't save custom rate.");
    } finally {
      setSavingCurrency(null);
    }
  };

  const handleResetToMarket = async (sourceCurrency: string) => {
    setSavingCurrency(sourceCurrency);
    try {
      const updated = await apiFetch<ExchangeRate>("/api/exchange-rates/override/", {
        method: "POST",
        body: JSON.stringify({
          source_currency: sourceCurrency,
          reset_to_market: true,
        }),
      });
      setRates((prev) => prev.map((r) => (r.source_currency === sourceCurrency ? updated : r)));
      setEditingValues((prev) => ({ ...prev, [sourceCurrency]: String(updated.rate) }));
      toast.success(`Reset ${sourceCurrency} to live market rate (${updated.market_rate}).`);
    } catch {
      toast.error("Couldn't reset to market rate.");
    } finally {
      setSavingCurrency(null);
    }
  };

  const CURRENCY_NAMES: Record<string, string> = {
    AED: "UAE Dirham",
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    SAR: "Saudi Riyal",
    QAR: "Qatari Riyal",
    KWD: "Kuwaiti Dinar",
    OMR: "Omani Rial",
    BHD: "Bahraini Dinar",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    SGD: "Singapore Dollar",
    INR: "Indian Rupee",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Base Currency Configuration Card */}
      <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-primary-600" />
              Organization Base Currency
            </h4>
            <p className="mt-1 text-xs text-ink-muted">
              All Analytics KPIs, Total Revenue Charts, and Financial Reports are calculated and aggregated in this base currency.
            </p>
          </div>
          <div className="w-40 flex-none">
            <select
              value={baseCurrency}
              onChange={(e) => onBaseCurrencyChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-primary-300 bg-white px-3 text-xs font-bold text-primary-800 shadow-xs focus:border-primary-500 focus:outline-hidden"
            >
              <option value="INR">INR — Indian Rupee (₹)</option>
              <option value="AED">AED — UAE Dirham (AED)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
              <option value="SAR">SAR — Saudi Riyal (SAR)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Exchange Rates Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">Foreign Exchange Rates</h3>
          <p className="text-xs text-ink-muted">
            Live rates convert client proposals & orders denominated in other currencies into your base currency ({baseCurrency}).
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 shadow-xs"
        >
          <Loader2 className={clsx("h-3.5 w-3.5 text-primary-600", syncing && "animate-spin")} />
          <span>{syncing ? "Syncing Rates..." : "Sync Live Forex"}</span>
        </Button>
      </div>

      {/* Rates Table */}
      {loading ? (
        <div className="flex h-36 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-sunken/50 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3">Foreign Currency</th>
                <th className="px-4 py-3">Live Market Rate</th>
                <th className="px-4 py-3">Effective System Rate (1 Unit in {baseCurrency})</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rates.map((r) => {
                const isOverridden = r.is_manual_override;
                const isSaving = savingCurrency === r.source_currency;
                const currVal = editingValues[r.source_currency] || String(r.rate);
                const hasChanged = currVal !== String(r.rate);

                return (
                  <tr key={r.source_currency} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">
                          {r.source_currency}
                        </span>
                        <span className="text-ink-muted text-xs">
                          {CURRENCY_NAMES[r.source_currency] || r.source_currency}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-ink-muted">
                      1 {r.source_currency} = <strong className="text-ink">{Number(r.market_rate).toFixed(4)}</strong> {baseCurrency}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <input
                          type="number"
                          step="0.0001"
                          value={currVal}
                          onChange={(e) =>
                            setEditingValues((prev) => ({
                              ...prev,
                              [r.source_currency]: e.target.value,
                            }))
                          }
                          className={clsx(
                            "h-7 w-28 rounded-md border px-2 font-mono text-xs font-semibold focus:outline-hidden",
                            isOverridden
                              ? "border-amber-400 bg-amber-50/50 text-amber-900 focus:border-amber-500"
                              : "border-border bg-white text-ink focus:border-primary-500",
                          )}
                        />
                        {hasChanged && (
                          <button
                            type="button"
                            onClick={() => handleSaveOverride(r.source_currency)}
                            disabled={isSaving}
                            className="rounded-md bg-primary-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-primary-700 transition-colors shadow-2xs"
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {isOverridden ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                          Manual Override
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                          Live Market
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => handleResetToMarket(r.source_currency)}
                          disabled={isSaving}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-800 hover:underline transition-colors"
                        >
                          Reset to Market
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FileField({
  label,
  current,
  file,
  onChange,
}: {
  label: string;
  current?: string | null;
  file?: File | null;
  onChange: (f: File | null) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const previewSrc = file ? URL.createObjectURL(file) : mediaUrl(current);

  useEffect(() => {
    setImgError(false);
  }, [current, file]);

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {previewSrc && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt=""
            className="h-11 max-w-[88px] rounded-md border border-border object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-border-strong text-ink-faint">
            <Upload className="h-4 w-4" />
          </div>
        )}
        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 text-[13px] font-semibold text-ink hover:bg-surface-hover">
          <Upload className="h-3.5 w-3.5" />
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        </label>
      </div>
    </Field>
  );
}
