"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { QuotationDetail } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { QuotationForm } from "../QuotationForm";
import { ClientQuotationPortalView } from "@/components/quotations/ClientQuotationPortalView";
import { LoadingState } from "@/components/ui/LoadingState";

export default function EditQuotationPage() {
  const params = useParams<{ id: string }>();
  const quotationId = Number(params.id);
  const { isClientUser } = useAuth();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<QuotationDetail>(`/api/quotations/${quotationId}/`)
      .then(setQuotation)
      .finally(() => setLoading(false));
  }, [quotationId]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/quotations" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotations
      </Link>
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingState size="lg" label="Loading Quotation..." sublabel="Preparing pricing & item breakdown" />
        </div>
      ) : quotation ? (
        isClientUser ? (
          <ClientQuotationPortalView quotation={quotation} onUpdate={(updated) => setQuotation(updated)} />
        ) : (
          <QuotationForm quotation={quotation} />
        )
      ) : (
        <p className="text-sm text-ink-faint">Quotation not found.</p>
      )}
    </div>
  );
}
