import re
from django.core.exceptions import FieldDoesNotExist
from django.db.models import (
    CharField,
    TextField,
    EmailField,
    SlugField,
    URLField,
    BooleanField,
    IntegerField,
    FloatField,
    DecimalField,
    DateField,
    DateTimeField,
    ForeignKey,
    JSONField,
    Q,
)
from rest_framework.filters import BaseFilterBackend, OrderingFilter


class DynamicQueryFilterBackend(BaseFilterBackend):
    """
    Universal Dynamic Column & JSONB Filter Backend.
    Supports:
      - Direct model field filters: `product_name=A4`, `status=draft`, `client_type=A`
      - Explicit model lookups: `product_name__icontains=A4`, `col__product_name=A4`
      - JSONB custom fields: `custom__<key>=<val>`, `custom__<key>__icontains=...`, `custom__<key>__gte=...`
      - Range lookups: `<field>_min`, `<field>_max`, `<field>_from`, `<field>_to` (for both model & custom JSONB fields)
      - Comma-separated `in` lookups: `status=draft,confirmed` or `status__in=draft,confirmed`
    """

    SAFE_LOOKUPS = {
        "exact": "exact",
        "iexact": "iexact",
        "icontains": "icontains",
        "contains": "contains",
        "gte": "gte",
        "lte": "lte",
        "gt": "gt",
        "lt": "lt",
        "in": "in",
        "isnull": "isnull",
        "startswith": "startswith",
        "istartswith": "istartswith",
    }

    IGNORED_PARAMS = {
        "page",
        "page_size",
        "format",
        "ordering",
        "search",
        "include_deleted",
    }

    def filter_queryset(self, request, queryset, view):
        params = getattr(request, "query_params", getattr(request, "GET", {}))
        model = queryset.model
        has_extra_data = any(f.name == "extra_data" and isinstance(f, JSONField) for f in model._meta.get_fields())
        has_item_extra_data = not has_extra_data and model._meta.model_name in ("costing", "order", "quotation")

        q_object = Q()

        for raw_key, raw_val in params.items():
            if raw_key in self.IGNORED_PARAMS or raw_val is None:
                continue

            val = raw_val.strip() if isinstance(raw_val, str) else str(raw_val).strip()
            if not val:
                continue

            # -------------------------------------------------------------
            # 1. Custom JSONB Fields (custom__*)
            # -------------------------------------------------------------
            if raw_key.startswith("custom__") and (has_extra_data or has_item_extra_data):
                extra_prefix = "extra_data" if has_extra_data else "items__extra_data"
                suffix_key = raw_key[8:]  # strip 'custom__'

                # Check if it's a range shorthand: custom__price_min, custom__date_from, etc.
                if suffix_key.endswith(("_min", "_from")):
                    field_key = suffix_key[:-4] if suffix_key.endswith("_min") else suffix_key[:-5]
                    q_object &= Q(**{f"{extra_prefix}__{field_key}__gte": val})
                    continue
                elif suffix_key.endswith(("_max", "_to")):
                    field_key = suffix_key[:-4] if suffix_key.endswith("_max") else suffix_key[:-3]
                    q_object &= Q(**{f"{extra_prefix}__{field_key}__lte": val})
                    continue

                parts = suffix_key.split("__")
                field_key = parts[0]
                lookup = parts[1] if len(parts) > 1 else None

                if lookup == "in" or ("," in val and not lookup):
                    values = [v.strip() for v in val.split(",") if v.strip()]
                    if values:
                        q_object &= Q(**{f"{extra_prefix}__{field_key}__in": values})
                elif lookup == "isnull":
                    is_null = val.lower() in ("true", "1", "yes")
                    q_object &= Q(**{f"{extra_prefix}__{field_key}__isnull": is_null})
                elif lookup and lookup in self.SAFE_LOOKUPS:
                    q_object &= Q(**{f"{extra_prefix}__{field_key}__{lookup}": val})
                elif val.lower() in ("true", "false"):
                    bool_val = val.lower() == "true"
                    q_object &= Q(**{f"{extra_prefix}__{field_key}": bool_val}) | Q(**{f"{extra_prefix}__{field_key}": val})
                else:
                    q_object &= Q(**{f"{extra_prefix}__{field_key}__icontains": val})
                continue

            # -------------------------------------------------------------
            # 2. Range shortcuts on model fields / annotations: *_min, *_max, *_from, *_to
            # -------------------------------------------------------------
            if raw_key.endswith(("_min", "_max", "_from", "_to")):
                if raw_key.endswith(("_min", "_from")):
                    base_name = raw_key[:-4] if raw_key.endswith("_min") else raw_key[:-5]
                    op = "gte"
                else:
                    base_name = raw_key[:-4] if raw_key.endswith("_max") else raw_key[:-3]
                    op = "lte"

                if base_name.startswith("col__"):
                    base_name = base_name[5:]

                target_field = self._resolve_target_field(model, base_name, queryset=queryset)
                if target_field:
                    q_object &= Q(**{f"{target_field}__{op}": val})
                    continue

            # -------------------------------------------------------------
            # 3. Model Fields & Annotations (either col__<field> or direct <field>)
            # -------------------------------------------------------------
            if raw_key in ("products", "product", "col__products", "col__product") and model._meta.model_name == "supplier":
                q_object &= (Q(supplier_products__product__product_name__icontains=val) | Q(product_details__icontains=val))
                continue

            field_expr = raw_key[5:] if raw_key.startswith("col__") else raw_key
            parts = field_expr.split("__")

            lookup = None
            if len(parts) > 1 and parts[-1] in self.SAFE_LOOKUPS:
                lookup = parts.pop()

            field_path = "__".join(parts)
            resolved_path = self._resolve_target_field(model, field_path, queryset=queryset, val=val) or field_path

            if queryset is not None and hasattr(queryset, "query") and resolved_path in queryset.query.annotations:
                if lookup:
                    q_object &= Q(**{f"{resolved_path}__{lookup}": val})
                else:
                    q_object &= Q(**{f"{resolved_path}": val})
                continue

            field_obj = self._get_model_field(model, resolved_path)

            if field_obj is not None:
                if lookup:
                    if lookup == "in":
                        values = [v.strip() for v in val.split(",") if v.strip()]
                        if values:
                            q_object &= Q(**{f"{resolved_path}__in": values})
                    elif lookup == "isnull":
                        is_null = val.lower() in ("true", "1", "yes")
                        q_object &= Q(**{f"{resolved_path}__isnull": is_null})
                    else:
                        q_object &= Q(**{f"{resolved_path}__{lookup}": val})
                else:
                    if isinstance(field_obj, (CharField, TextField, EmailField, SlugField, URLField)):
                        if getattr(field_obj, "choices", None):
                            q_object &= Q(**{f"{resolved_path}": val})
                        else:
                            q_object &= Q(**{f"{resolved_path}__icontains": val})
                    elif isinstance(field_obj, BooleanField):
                        bool_val = val.lower() in ("true", "1", "yes")
                        q_object &= Q(**{f"{resolved_path}": bool_val})
                    elif "," in val:
                        values = [v.strip() for v in val.split(",") if v.strip()]
                        if values:
                            q_object &= Q(**{f"{resolved_path}__in": values})
                    else:
                        if isinstance(field_obj, ForeignKey) and not val.isdigit():
                            related_name_field = "client_name" if "client" in resolved_path else ("company_name" if "company" in resolved_path else ("supplier_name" if "supplier" in resolved_path else ("project_name" if "project" in resolved_path else "product_name")))
                            if self._get_model_field(model, f"{resolved_path}__{related_name_field}"):
                                q_object &= Q(**{f"{resolved_path}__{related_name_field}__icontains": val})
                            else:
                                q_object &= Q(**{f"{resolved_path}": val})
                        else:
                            q_object &= Q(**{f"{resolved_path}": val})
                continue

        return queryset.filter(q_object)

    def _get_model_field(self, model, field_path: str):
        """Returns the django model field object if field_path is valid, else None."""
        parts = field_path.split("__")
        curr_model = model
        field = None
        for part in parts:
            try:
                field = curr_model._meta.get_field(part)
                if field.is_relation and field.related_model:
                    curr_model = field.related_model
            except (FieldDoesNotExist, AttributeError):
                return None
        return field

    def _resolve_target_field(self, model, base_name: str, queryset=None, val: str = "") -> str | None:
        """Resolves common filter shortcuts or exact field names to model fields or annotations."""
        is_num = str(val).isdigit() or (str(val).startswith("-") and str(val)[1:].isdigit())
        if is_num and self._get_model_field(model, base_name) is not None:
            return base_name

        FIELD_MAP = {
            "date": ["date", "quotation_date", "costing_date", "created_at"],
            "costing_date": ["costing_date"],
            "amount": ["grand_total", "subtotal", "annotated_supplier_cost", "supplier_cost", "annotated_client_revenue", "client_revenue"],
            "grand_total": ["grand_total"],
            "subtotal": ["subtotal"],
            "supplier_rate": ["items__supplier_rate", "supplier_rate"],
            "quantity": ["items__quantity", "quantity", "qty"],
            "qty": ["items__quantity", "quantity", "qty"],
            "client_rate": ["items__client_rate", "client_rate"],
            "supplier_cost": ["annotated_supplier_cost", "items__supplier_rate", "supplier_cost"],
            "client_revenue": ["annotated_client_revenue", "items__client_rate", "client_revenue"],
            "profit": ["annotated_profit", "profit"],
            "profit_percent": ["annotated_profit_percent", "profit_percent"],
            "created": ["created_at"],
            "created_at": ["created_at"],
            "updated_at": ["updated_at"],
            "client_name": ["client__client_name", "client_name"],
            "client": ["client" if is_num else "client__client_name", "client_name", "client"],
            "company_name": ["company__company_name", "client__company__company_name", "company_name"],
            "company": ["company" if is_num else "company__company_name", "client__company__company_name", "company_name", "company"],
            "supplier_name": ["supplier__supplier_name", "supplier_name"],
            "supplier": ["supplier" if is_num else "supplier__supplier_name", "supplier_name", "supplier"],
            "project_name": ["project__name", "project__project_name", "project_name", "name"],
            "project": ["project" if is_num else "project__name", "project__project_name", "project_name", "project", "name"],
            "product_name": ["supplier_products__product__product_name", "product__product_name", "product_name"],
            "product": ["product" if is_num else "product__product_name", "supplier_products__product__product_name", "product_name", "product", "product_details"],
            "products": ["product" if is_num else "product__product_name", "supplier_products__product__product_name", "product_name", "product_details"],
            "file": ["files__file_name", "file_name"],
            "file_name": ["files__file_name", "file_name"],
            "description": ["description", "remarks", "remark"],
            "remarks": ["description", "remarks", "remark"],
            "tax_percent": ["tax_percent"],
            "tax_amount": ["tax_amount"],
            "paid_amount": ["paid_amount"],
            "due_amount": ["annotated_due_amount", "due_amount"],
            "currency_code": ["currency_code"],
            "delivery_time": ["delivery_time"],
            "project_title": ["project_title"],
        }
        candidates = FIELD_MAP.get(base_name, [base_name])
        for c in candidates:
            if queryset is not None and hasattr(queryset, "query") and c in queryset.query.annotations:
                return c
            if self._get_model_field(model, c) is not None:
                return c
        return None


class CRMOrderingFilter(OrderingFilter):
    """
    Universal Ordering Filter for CRM.
    Supports:
      - Field aliases (e.g. `date` -> `costing_date` / `order_date` / `quotation_date`)
      - Related lookups (e.g. `client` -> `client__client_name`, `supplier` -> `supplier__supplier_name`)
      - Queryset annotations (e.g. `profit`, `profit_percent`, `supplier_cost`, `client_revenue`)
      - Multi-field sorting comma-separated: `?ordering=-date,client`
    """

    ordering_param = "ordering"

    ALIAS_MAP = {
        "date": ["costing_date", "order_date", "quotation_date", "date", "created_at"],
        "order_date": ["date", "order_date"],
        "costing_date": ["costing_date", "date"],
        "quotation_date": ["quotation_date", "date"],
        "created_date": ["created_at", "created_date"],
        "updated_date": ["updated_at", "updated_date"],
        "client": ["client__client_name", "client__name", "client_name", "client"],
        "client_name": ["client__client_name", "client__name", "client_name"],
        "supplier": ["supplier__supplier_name", "supplier__name", "supplier_name", "supplier"],
        "supplier_name": ["supplier__supplier_name", "supplier__name", "supplier_name"],
        "product": ["product__product_name", "product__name", "product_name", "product"],
        "product_name": ["product__product_name", "product__name", "product_name"],
        "project_name": ["project__name", "project_name"],
        "company": ["company__company_name", "client__company__company_name", "company__name", "company_name", "company"],
        "company_name": ["company__company_name", "client__company__company_name", "company_name"],
        "profit": ["annotated_profit", "profit"],
        "profit_percent": ["annotated_profit_percent", "profit_percent"],
        "supplier_cost": ["annotated_supplier_cost", "supplier_cost"],
        "client_revenue": ["annotated_client_revenue", "client_revenue"],
        "amount": ["total_amount", "grand_total", "annotated_subtotal", "subtotal", "annotated_total_amount", "amount"],
        "subtotal": ["subtotal", "annotated_subtotal", "grand_total", "total_amount"],
        "grand_total": ["grand_total", "total_amount", "annotated_subtotal", "subtotal"],
        "rate": ["rate", "supplier_rate", "client_rate"],
        "quantity": ["quantity", "total_qty", "qty"],
        "qty": ["quantity", "total_qty", "qty"],
    }

    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)
        if ordering:
            try:
                return queryset.order_by(*ordering)
            except Exception:
                pass
        return queryset

    def get_ordering(self, request, queryset, view):
        params = request.query_params.get(self.ordering_param)
        if not params:
            return getattr(view, "ordering", None)

        fields = [param.strip() for param in params.split(",") if param.strip()]
        resolved_ordering = []
        model = queryset.model
        annotations = getattr(queryset.query, "annotations", {}) if hasattr(queryset, "query") else {}
        custom_aliases = getattr(view, "ordering_aliases", {})

        for raw_term in fields:
            descending = raw_term.startswith("-")
            clean_term = raw_term.lstrip("-+")
            prefix = "-" if descending else ""

            # 1. Custom view aliases
            if clean_term in custom_aliases:
                target = custom_aliases[clean_term]
                resolved_ordering.append(f"{prefix}{target}")
                continue

            # 2. Check if clean_term is already an annotation
            if clean_term in annotations:
                resolved_ordering.append(f"{prefix}{clean_term}")
                continue

            # 3. Check if clean_term is a direct model field
            try:
                model._meta.get_field(clean_term)
                resolved_ordering.append(f"{prefix}{clean_term}")
                continue
            except FieldDoesNotExist:
                pass

            # 4. Check ALIAS_MAP candidates
            candidates = self.ALIAS_MAP.get(clean_term, [])
            matched = False
            for cand in candidates:
                if cand in annotations:
                    resolved_ordering.append(f"{prefix}{cand}")
                    matched = True
                    break
                parts = cand.split("__")
                cur_model = model
                valid = True
                for p in parts:
                    try:
                        f = cur_model._meta.get_field(p)
                        if f.is_relation and f.related_model:
                            cur_model = f.related_model
                    except FieldDoesNotExist:
                        valid = False
                        break
                if valid:
                    resolved_ordering.append(f"{prefix}{cand}")
                    matched = True
                    break

            if not matched and clean_term:
                parts = clean_term.split("__")
                cur_model = model
                valid = True
                for p in parts:
                    try:
                        f = cur_model._meta.get_field(p)
                        if f.is_relation and f.related_model:
                            cur_model = f.related_model
                    except FieldDoesNotExist:
                        valid = False
                        break
                if valid:
                    resolved_ordering.append(f"{prefix}{clean_term}")

        if resolved_ordering and not any(t.lstrip("-+") == "id" for t in resolved_ordering):
            first_term = resolved_ordering[0]
            date_fields = {"date", "order_date", "costing_date", "quotation_date", "created_at", "updated_at"}
            if first_term.lstrip("-+") in date_fields:
                resolved_ordering.append("-id" if first_term.startswith("-") else "id")

        return resolved_ordering or getattr(view, "ordering", None)


