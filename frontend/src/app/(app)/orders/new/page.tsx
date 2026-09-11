"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderForm } from "../OrderForm";

export default function NewOrderPage() {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  const initialProjectId = projectParam ? Number(projectParam) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/orders" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
      </Link>
      <OrderForm initialProjectId={initialProjectId} />
    </div>
  );
}
