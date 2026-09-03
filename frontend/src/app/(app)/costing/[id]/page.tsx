"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CostingDetail } from "@/lib/types";
import { CostingForm } from "../CostingForm";

export default function EditCostingPage() {
  const params = useParams<{ id: string }>();
  const costingId = Number(params.id);
  const [costing, setCosting] = useState<CostingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CostingDetail>(`/api/costings/${costingId}/`)
      .then(setCosting)
      .finally(() => setLoading(false));
  }, [costingId]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/costing" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Costing
      </Link>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
        </div>
      ) : costing ? (
        <CostingForm costing={costing} />
      ) : (
        <p className="text-sm text-ink-faint">Costing sheet not found.</p>
      )}
    </div>
  );
}
