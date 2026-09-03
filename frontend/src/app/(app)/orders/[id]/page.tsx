"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { OrderDetail } from "@/lib/types";
import { OrderForm } from "../OrderForm";

export default function EditOrderPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<OrderDetail>(`/api/orders/${orderId}/`)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/orders" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
      </Link>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
        </div>
      ) : order ? (
        <OrderForm order={order} />
      ) : (
        <p className="text-sm text-ink-faint">Order not found.</p>
      )}
    </div>
  );
}
