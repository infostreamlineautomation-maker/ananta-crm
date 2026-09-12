"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CostingForm } from "../CostingForm";

export default function NewCostingPage() {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/costing" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Costing
      </Link>
      <CostingForm />
    </div>
  );
}
