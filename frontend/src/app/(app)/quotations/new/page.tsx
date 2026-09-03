"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QuotationForm } from "../QuotationForm";

export default function NewQuotationPage() {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  const initialProjectId = projectParam ? Number(projectParam) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/quotations" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotations
      </Link>
      <QuotationForm initialProjectId={initialProjectId} />
    </div>
  );
}
