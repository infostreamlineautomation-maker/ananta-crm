import csv
from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Case, Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from apps.accounts.permissions import has_permission
from apps.core.forex import get_exchange_rate
from apps.core.modules import REPORTS, VIEW
from apps.costing.models import Costing, CostingItem
from apps.orders.models import Order, OrderItem
from apps.quotations.models import Quotation, QuotationItem

MONEY = DecimalField(max_digits=14, decimal_places=2)
TRACKED_CURRENCIES = ["INR", "AED", "USD", "EUR", "GBP", "SAR", "QAR", "KWD", "OMR", "BHD", "CAD", "AUD", "SGD"]


def _converted_order_expr(org, base_curr, amount_field="grand_total"):
    whens = []
    for c in TRACKED_CURRENCIES:
        if c.upper() == (base_curr or "INR").upper():
            whens.append(When(currency_code=c, then=F(amount_field)))
        else:
            rate = get_exchange_rate(c, base_curr, org)
            whens.append(When(currency_code=c, then=ExpressionWrapper(F(amount_field) * Value(rate), output_field=MONEY)))
    return Case(*whens, default=F(amount_field), output_field=MONEY)


def _converted_paid_expr(org, base_curr):
    effective_paid = Case(
        When(
            payment_status=Order.PAYMENT_PAID,
            then=Case(
                When(paid_amount__gt=0, then=F("paid_amount")),
                default=F("grand_total"),
                output_field=MONEY,
            ),
        ),
        When(payment_status=Order.PAYMENT_PARTIAL, then=Coalesce(F("paid_amount"), Decimal("0"), output_field=MONEY)),
        default=Coalesce(F("paid_amount"), Decimal("0"), output_field=MONEY),
        output_field=MONEY,
    )
    whens = []
    for c in TRACKED_CURRENCIES:
        if c.upper() == (base_curr or "INR").upper():
            whens.append(When(currency_code=c, then=effective_paid))
        else:
            rate = get_exchange_rate(c, base_curr, org)
            whens.append(When(currency_code=c, then=ExpressionWrapper(effective_paid * Value(rate), output_field=MONEY)))
    return Case(*whens, default=effective_paid, output_field=MONEY)


def _converted_item_expr(org, base_curr):
    whens = []
    for c in TRACKED_CURRENCIES:
        if c.upper() == (base_curr or "INR").upper():
            whens.append(When(order__currency_code=c, then=ExpressionWrapper(F("qty") * F("rate"), output_field=MONEY)))
        else:
            rate = get_exchange_rate(c, base_curr, org)
            whens.append(
                When(order__currency_code=c, then=ExpressionWrapper(F("qty") * F("rate") * Value(rate), output_field=MONEY))
            )
    return Case(*whens, default=ExpressionWrapper(F("qty") * F("rate"), output_field=MONEY), output_field=MONEY)


class _ReportPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_permission(request.user, REPORTS, VIEW)


def _date_range(request):
    return request.query_params.get("date_from"), request.query_params.get("date_to")


def _date_filtered_orders(request, date_from=None, date_to=None):
    if date_from is None and date_to is None:
        date_from, date_to = _date_range(request)
    qs = Order.objects.filter(organization=request.organization)
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    return qs


@api_view(["GET"])
@permission_classes([_ReportPermission])
def summary(request):
    qs = _date_filtered_orders(request)
    base_curr = request.organization.default_currency_code if request.organization else "INR"
    conv_expr = _converted_order_expr(request.organization, base_curr)
    conv_paid = _converted_paid_expr(request.organization, base_curr)
    totals = qs.aggregate(
        total_orders=Count("id"),
        total_revenue=Coalesce(Sum(conv_expr), Decimal("0"), output_field=MONEY),
        paid_revenue=Coalesce(Sum(conv_paid), Decimal("0"), output_field=MONEY),
    )
    total_rev = totals["total_revenue"]
    paid_rev = totals["paid_revenue"]
    pending_rev = total_rev - paid_rev
    total_orders = totals["total_orders"]
    avg_order_value = (total_rev / total_orders) if total_orders > 0 else Decimal("0")

    return Response(
        {
            "base_currency_code": base_curr,
            "total_orders": total_orders,
            "total_revenue": total_rev,
            "paid_revenue": paid_rev,
            "pending_revenue": pending_rev,
            "avg_order_value": round(avg_order_value, 2),
        }
    )


@api_view(["GET"])
@permission_classes([_ReportPermission])
def sales_by_product(request):
    date_from, date_to = _date_range(request)
    org = request.organization
    base_curr = org.default_currency_code if org else "INR"
    conv_item = _converted_item_expr(org, base_curr)
    qs = OrderItem.objects.filter(order__organization=org)
    if date_from:
        qs = qs.filter(order__date__gte=date_from)
    if date_to:
        qs = qs.filter(order__date__lte=date_to)

    rows = list(
        qs.values("product_id", "product__product_name")
        .annotate(
            total_qty=Sum("qty"),
            revenue=Sum(conv_item),
        )
        .order_by("-revenue")
    )

    total_revenue_sum = sum((r["revenue"] or Decimal("0") for r in rows), Decimal("0"))
    for r in rows:
        rev = r["revenue"] or Decimal("0")
        r["share_pct"] = round(float(rev / total_revenue_sum * 100), 1) if total_revenue_sum > 0 else 0.0

    return Response(rows)


@api_view(["GET"])
@permission_classes([_ReportPermission])
def top_clients(request):
    limit = int(request.query_params.get("limit", 10))
    qs = _date_filtered_orders(request)
    org = request.organization
    base_curr = org.default_currency_code if org else "INR"
    conv_expr = _converted_order_expr(org, base_curr)
    rows = list(
        qs.values("client_id", "client__client_name")
        .annotate(revenue=Sum(conv_expr), order_count=Count("id"))
        .order_by("-revenue")[:limit]
    )

    total_revenue_sum = sum((r["revenue"] or Decimal("0") for r in rows), Decimal("0"))
    for r in rows:
        rev = r["revenue"] or Decimal("0")
        cnt = r["order_count"] or 1
        r["avg_order_value"] = round(rev / cnt, 2)
        r["share_pct"] = round(float(rev / total_revenue_sum * 100), 1) if total_revenue_sum > 0 else 0.0

    return Response(rows)


@api_view(["GET"])
@permission_classes([_ReportPermission])
def analytics(request):
    """Rich aggregated analytics dataset: time series trends, growth rates,
    delivery/payment funnels, quotation conversions, and costing margins."""
    date_from_str, date_to_str = _date_range(request)
    org = request.organization
    base_curr_code = (org.default_currency_code if org else "INR").upper()
    conv_order = _converted_order_expr(org, base_curr_code)
    conv_paid = _converted_paid_expr(org, base_curr_code)
    conv_item = _converted_item_expr(org, base_curr_code)

    # Parse dates or default to current month
    today = datetime.now().date()
    try:
        start_date = datetime.strptime(date_from_str, "%Y-%m-%d").date() if date_from_str else today.replace(day=1)
    except ValueError:
        start_date = today.replace(day=1)

    try:
        end_date = datetime.strptime(date_to_str, "%Y-%m-%d").date() if date_to_str else today
    except ValueError:
        end_date = today

    if start_date > end_date:
        start_date, end_date = end_date, start_date

    # Period duration & previous period for growth comparison
    duration_days = (end_date - start_date).days + 1
    prev_end_date = start_date - timedelta(days=1)
    prev_start_date = prev_end_date - timedelta(days=duration_days - 1)

    # Current period orders
    orders_qs = Order.objects.filter(organization=org, date__gte=start_date, date__lte=end_date)
    prev_orders_qs = Order.objects.filter(organization=org, date__gte=prev_start_date, date__lte=prev_end_date)

    # Current totals
    cur_totals = orders_qs.aggregate(
        total_orders=Count("id"),
        total_revenue=Coalesce(Sum(conv_order), Decimal("0"), output_field=MONEY),
        paid_revenue=Coalesce(Sum(conv_paid), Decimal("0"), output_field=MONEY),
        partial_revenue=Coalesce(
            Sum(conv_paid, filter=Q(payment_status=Order.PAYMENT_PARTIAL)), Decimal("0"), output_field=MONEY
        ),
        unique_clients=Count("client_id", distinct=True),
    )

    # Prev totals
    prev_totals = prev_orders_qs.aggregate(
        total_orders=Count("id"),
        total_revenue=Coalesce(Sum(conv_order), Decimal("0"), output_field=MONEY),
    )

    cur_rev = cur_totals["total_revenue"]
    prev_rev = prev_totals["total_revenue"]
    cur_orders = cur_totals["total_orders"]
    prev_orders = prev_totals["total_orders"]

    rev_growth = round(float((cur_rev - prev_rev) / prev_rev * 100), 1) if prev_rev > 0 else (100.0 if cur_rev > 0 else 0.0)
    orders_growth = round(float((cur_orders - prev_orders) / prev_orders * 100), 1) if prev_orders > 0 else (100.0 if cur_orders > 0 else 0.0)

    paid_rev = cur_totals["paid_revenue"]
    pending_rev = max(Decimal("0"), cur_rev - paid_rev)
    avg_order_value = round(cur_rev / cur_orders, 2) if cur_orders > 0 else Decimal("0")

    # Time series points (daily or grouped)
    date_points = []
    daily_stats = (
        orders_qs.values("date")
        .annotate(
            revenue=Coalesce(Sum(conv_order), Decimal("0"), output_field=MONEY),
            paid=Coalesce(Sum(conv_paid), Decimal("0"), output_field=MONEY),
            orders_count=Count("id"),
        )
        .order_by("date")
    )
    daily_map = {row["date"].strftime("%Y-%m-%d"): row for row in daily_stats}

    curr_d = start_date
    while curr_d <= end_date:
        d_str = curr_d.strftime("%Y-%m-%d")
        item = daily_map.get(d_str)
        date_points.append(
            {
                "date": d_str,
                "label": curr_d.strftime("%d %b"),
                "revenue": float(item["revenue"]) if item else 0.0,
                "paid": float(item["paid"]) if item else 0.0,
                "orders_count": item["orders_count"] if item else 0,
            }
        )
        curr_d += timedelta(days=1)

    # Payment Status Breakdown
    payment_counts = orders_qs.values("payment_status").annotate(
        count=Count("id"),
        total=Coalesce(Sum(conv_order), Decimal("0"), output_field=MONEY),
        paid_total=Coalesce(Sum(conv_paid), Decimal("0"), output_field=MONEY),
    )
    payment_map = {row["payment_status"]: row for row in payment_counts}
    paid_item = payment_map.get(Order.PAYMENT_PAID, {})
    partial_item = payment_map.get(Order.PAYMENT_PARTIAL, {})
    pending_item = payment_map.get(Order.PAYMENT_PENDING, {})

    paid_amt = float(paid_item.get("paid_total", paid_item.get("total", 0)))
    partial_amt = float(partial_item.get("paid_total", 0))
    pending_amt = float(pending_rev)

    payment_breakdown = [
        {
            "status": "paid",
            "label": "Paid",
            "count": paid_item.get("count", 0),
            "amount": paid_amt,
            "color": "#16a34a",
        },
        {
            "status": "partial",
            "label": "Partial",
            "count": partial_item.get("count", 0),
            "amount": partial_amt,
            "color": "#d97706",
        },
        {
            "status": "pending",
            "label": "Pending",
            "count": pending_item.get("count", 0),
            "amount": pending_amt,
            "color": "#dc2626",
        },
    ]

    # Delivery Status Breakdown
    delivery_counts = orders_qs.values("delivery_status").annotate(
        count=Count("id"),
        total=Coalesce(Sum(conv_order), Decimal("0"), output_field=MONEY),
    )
    delivery_map = {row["delivery_status"]: row for row in delivery_counts}
    delivery_breakdown = [
        {
            "status": "pending",
            "label": "Pending",
            "count": delivery_map.get(Order.PENDING, {}).get("count", 0),
            "amount": float(delivery_map.get(Order.PENDING, {}).get("total", 0)),
            "color": "#64748b",
        },
        {
            "status": "in_process",
            "label": "In Process",
            "count": delivery_map.get(Order.IN_PROCESS, {}).get("count", 0),
            "amount": float(delivery_map.get(Order.IN_PROCESS, {}).get("total", 0)),
            "color": "#2563eb",
        },
        {
            "status": "ready",
            "label": "Ready",
            "count": delivery_map.get(Order.READY, {}).get("count", 0),
            "amount": float(delivery_map.get(Order.READY, {}).get("total", 0)),
            "color": "#0d9488",
        },
        {
            "status": "delivered",
            "label": "Delivered",
            "count": delivery_map.get(Order.DELIVERED, {}).get("count", 0),
            "amount": float(delivery_map.get(Order.DELIVERED, {}).get("total", 0)),
            "color": "#16a34a",
        },
    ]

    # Quotation Funnel
    quotations_qs = Quotation.objects.filter(
        organization=org, quotation_date__gte=start_date, quotation_date__lte=end_date
    )
    quote_counts = quotations_qs.values("status").annotate(count=Count("id"))
    quote_map = {row["status"]: row["count"] for row in quote_counts}
    total_quotes = quotations_qs.count()
    accepted_quotes = quote_map.get(Quotation.ACCEPTED, 0)
    conversion_rate = round(float(accepted_quotes / total_quotes * 100), 1) if total_quotes > 0 else 0.0

    quotation_funnel = {
        "total_quotations": total_quotes,
        "draft": quote_map.get(Quotation.DRAFT, 0),
        "sent": quote_map.get(Quotation.SENT, 0),
        "accepted": accepted_quotes,
        "rejected": quote_map.get(Quotation.REJECTED, 0),
        "conversion_rate": conversion_rate,
    }

    # Costing Margin Analysis
    costings_qs = Costing.objects.filter(
        organization=org, costing_date__gte=start_date, costing_date__lte=end_date
    ).prefetch_related("items", "client__company__country")
    total_costings = costings_qs.count()
    total_cost = Decimal("0")
    total_costing_rev = Decimal("0")
    for c in costings_qs:
        c_curr = c.client.effective_country.currency_code if (c.client and c.client.effective_country) else "INR"
        rate = Decimal(str(get_exchange_rate(c_curr, base_curr_code, org)))
        total_cost += c.supplier_cost * rate
        total_costing_rev += c.client_revenue * rate

    total_profit = total_costing_rev - total_cost
    avg_margin_pct = round(float(total_profit / total_cost * 100), 1) if total_cost > 0 else 0.0

    costing_overview = {
        "total_costings": total_costings,
        "total_supplier_cost": round(total_cost, 2),
        "total_client_revenue": round(total_costing_rev, 2),
        "total_profit": round(total_profit, 2),
        "avg_margin_percent": avg_margin_pct,
    }

    # Top products (top 5)
    prod_qs = (
        OrderItem.objects.filter(order__organization=org, order__date__gte=start_date, order__date__lte=end_date)
        .values("product__product_name")
        .annotate(
            total_qty=Sum("qty"),
            revenue=Sum(conv_item),
        )
        .order_by("-revenue")[:5]
    )
    top_products = [
        {
            "name": p["product__product_name"] or "Custom Item",
            "qty": float(p["total_qty"] or 0),
            "revenue": float(p["revenue"] or 0),
            "share_pct": round(float((p["revenue"] or 0) / cur_rev * 100), 1) if cur_rev > 0 else 0.0,
        }
        for p in prod_qs
    ]

    # Top clients (top 5)
    client_qs = (
        orders_qs.values("client__client_name")
        .annotate(revenue=Sum(conv_order), order_count=Count("id"))
        .order_by("-revenue")[:5]
    )
    top_clients_list = [
        {
            "name": c["client__client_name"] or "Unknown Client",
            "revenue": float(c["revenue"] or 0),
            "order_count": c["order_count"],
            "share_pct": round(float((c["revenue"] or 0) / cur_rev * 100), 1) if cur_rev > 0 else 0.0,
        }
        for c in client_qs
    ]

    base_curr_code = org.default_currency_code if org else "INR"

    return Response(
        {
            "date_from": start_date.strftime("%Y-%m-%d"),
            "date_to": end_date.strftime("%Y-%m-%d"),
            "kpis": {
                "total_revenue": cur_rev,
                "paid_revenue": paid_rev,
                "pending_revenue": pending_rev,
                "total_orders": cur_orders,
                "avg_order_value": avg_order_value,
                "active_clients": cur_totals["unique_clients"],
                "revenue_growth": rev_growth,
                "orders_growth": orders_growth,
                "prev_revenue": prev_rev,
                "prev_orders": prev_orders,
            },
            "trend": date_points,
            "payment_breakdown": payment_breakdown,
            "delivery_breakdown": delivery_breakdown,
            "quotation_funnel": quotation_funnel,
            "costing_overview": costing_overview,
            "top_products": top_products,
            "top_clients": top_clients_list,
            "base_currency_code": base_curr_code,
        }
    )


@api_view(["GET"])
@permission_classes([_ReportPermission])
def export_csv(request):
    """Download a comprehensive, Excel-ready CSV financial report containing
    KPI summaries, multi-currency converted billing register, grand totals, and product/client breakdowns."""
    date_from_str, date_to_str = _date_range(request)
    org = request.organization
    base_curr = (org.default_currency_code if org else "INR").upper()

    orders_qs = (
        _date_filtered_orders(request)
        .select_related("client", "client__company", "project")
        .order_by("-date", "-id")
    )

    # Optional status filters
    delivery_status = request.query_params.get("delivery_status")
    if delivery_status:
        orders_qs = orders_qs.filter(delivery_status=delivery_status)
    payment_status = request.query_params.get("payment_status")
    if payment_status:
        orders_qs = orders_qs.filter(payment_status=payment_status)

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    filename = f"sales_report_{base_curr}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    # Write UTF-8 BOM so Excel opens with proper symbols and formatting
    response.write("\ufeff")

    writer = csv.writer(response)

    # 1. Report Header Metadata
    company_name = org.name if org else "Ananta CRM"
    writer.writerow([f"{company_name.upper()} - COMPREHENSIVE SALES & FINANCIAL REPORT"])
    writer.writerow(["Generated At:", datetime.now().strftime("%d %b %Y, %I:%M %p"), "", "Base Currency:", base_curr])
    writer.writerow(
        ["Date Filter Range:", f"{date_from_str or 'Earliest'} to {date_to_str or 'Latest'}" if (date_from_str or date_to_str) else "All Time"]
    )
    writer.writerow([])

    # Compute converted totals
    total_orders_count = orders_qs.count()
    total_rev_converted = Decimal("0")
    paid_rev_converted = Decimal("0")
    pending_rev_converted = Decimal("0")
    unique_clients = set()

    order_rows = []
    for o in orders_qs:
        o_curr = (o.currency_code or base_curr).upper()
        rate = Decimal(str(get_exchange_rate(o_curr, base_curr, org)))
        conv_total = round(o.grand_total * rate, 2)
        total_rev_converted += conv_total

        if o.payment_status == Order.PAYMENT_PAID:
            actual_paid = o.paid_amount if (o.paid_amount and o.paid_amount > 0) else o.grand_total
            conv_paid = round(actual_paid * rate, 2)
            conv_pending = max(Decimal("0"), conv_total - conv_paid)
            paid_rev_converted += conv_paid
            pending_rev_converted += conv_pending
        elif o.payment_status == Order.PAYMENT_PARTIAL:
            actual_paid = o.paid_amount or Decimal("0")
            conv_paid = round(actual_paid * rate, 2)
            conv_pending = max(Decimal("0"), conv_total - conv_paid)
            paid_rev_converted += conv_paid
            pending_rev_converted += conv_pending
        else:
            actual_paid = o.paid_amount or Decimal("0")
            conv_paid = round(actual_paid * rate, 2)
            conv_pending = max(Decimal("0"), conv_total - conv_paid)
            paid_rev_converted += conv_paid
            pending_rev_converted += conv_pending

        if o.client_id:
            unique_clients.add(o.client_id)

        client_name = o.client.client_name if o.client else "—"
        company_label = o.client.company.company_name if (o.client and o.client.company) else "—"
        project_label = o.project.name if o.project else "—"

        order_rows.append(
            [
                o.order_no,
                o.date.strftime("%Y-%m-%d") if hasattr(o.date, "strftime") else str(o.date),
                client_name,
                company_label,
                project_label,
                o.get_delivery_status_display(),
                o.get_payment_status_display(),
                o_curr,
                f"{o.subtotal:.2f}",
                f"{o.tax_percent:.2f}%",
                f"{o.tax_amount:.2f}",
                f"{o.grand_total:.2f}",
                f"{conv_total:.2f}",
                f"{conv_paid:.2f}",
                f"{conv_pending:.2f}",
            ]
        )

    avg_order_val = (total_rev_converted / total_orders_count) if total_orders_count > 0 else Decimal("0")

    # 2. Executive Summary KPIs Table
    writer.writerow([f"EXECUTIVE SUMMARY (DENOMINATED IN {base_curr})"])
    writer.writerow(
        [
            "Total Orders",
            f"Total Revenue ({base_curr})",
            f"Paid Collections ({base_curr})",
            f"Pending Balance ({base_curr})",
            f"Avg Order Value ({base_curr})",
            "Active Clients",
        ]
    )
    writer.writerow(
        [
            total_orders_count,
            f"{total_rev_converted:.2f}",
            f"{paid_rev_converted:.2f}",
            f"{pending_rev_converted:.2f}",
            f"{avg_order_val:.2f}",
            len(unique_clients),
        ]
    )
    writer.writerow([])

    # 3. Itemized Orders Register Table
    writer.writerow(["DETAILED ORDERS & BILLING REGISTER"])
    writer.writerow(
        [
            "Order No",
            "Date",
            "Client Name",
            "Company",
            "Project",
            "Delivery Status",
            "Payment Status",
            "Native Currency",
            "Subtotal",
            "Tax Rate",
            "Tax Amount",
            "Grand Total (Native)",
            f"Grand Total ({base_curr})",
            f"Paid Amount ({base_curr})",
            f"Pending Amount ({base_curr})",
        ]
    )

    for row in order_rows:
        writer.writerow(row)

    # Grand Total row in the table
    writer.writerow(
        [
            "GRAND TOTAL SUMMARY",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            f"{total_rev_converted:.2f}",
            f"{paid_rev_converted:.2f}",
            f"{pending_rev_converted:.2f}",
        ]
    )
    writer.writerow([])

    # 4. Product Sales Summary
    conv_item = _converted_item_expr(org, base_curr)
    prod_qs = (
        OrderItem.objects.filter(order__in=orders_qs)
        .values("product__product_name")
        .annotate(total_qty=Sum("qty"), revenue=Sum(conv_item))
        .order_by("-revenue")[:20]
    )

    if prod_qs.exists():
        writer.writerow([f"PRODUCT SALES BREAKDOWN (TOP PRODUCTS IN {base_curr})"])
        writer.writerow(["Product Name", "Units Sold", f"Total Revenue ({base_curr})", "Revenue Share (%)"])
        for p in prod_qs:
            p_rev = p["revenue"] or Decimal("0")
            share = round(float(p_rev / total_rev_converted * 100), 1) if total_rev_converted > 0 else 0.0
            writer.writerow(
                [
                    p["product__product_name"] or "Custom Item",
                    f"{float(p['total_qty'] or 0):.2f}",
                    f"{p_rev:.2f}",
                    f"{share:.1f}%",
                ]
            )
        writer.writerow([])

    # 5. Client Sales Summary
    conv_order = _converted_order_expr(org, base_curr)
    client_qs = (
        orders_qs.values("client__client_name")
        .annotate(revenue=Sum(conv_order), order_count=Count("id"))
        .order_by("-revenue")[:20]
    )

    if client_qs.exists():
        writer.writerow([f"CLIENT REVENUE CONTRIBUTION (TOP CLIENTS IN {base_curr})"])
        writer.writerow(["Client Name", "Orders Count", f"Total Revenue ({base_curr})", "Revenue Share (%)"])
        for c in client_qs:
            c_rev = c["revenue"] or Decimal("0")
            share = round(float(c_rev / total_rev_converted * 100), 1) if total_rev_converted > 0 else 0.0
            writer.writerow(
                [
                    c["client__client_name"] or "Unknown Client",
                    c["order_count"],
                    f"{c_rev:.2f}",
                    f"{share:.1f}%",
                ]
            )

    return response
