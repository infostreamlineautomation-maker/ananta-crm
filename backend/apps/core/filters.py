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
from rest_framework.filters import BaseFilterBackend


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
            if raw_key.startswith("custom__") and has_extra_data:
                suffix_key = raw_key[8:]  # strip 'custom__'

                # Check if it's a range shorthand: custom__price_min, custom__date_from, etc.
                if suffix_key.endswith(("_min", "_from")):
                    field_key = suffix_key[:-4] if suffix_key.endswith("_min") else suffix_key[:-5]
                    q_object &= Q(**{f"extra_data__{field_key}__gte": val})
                    continue
                elif suffix_key.endswith(("_max", "_to")):
                    field_key = suffix_key[:-4] if suffix_key.endswith("_max") else suffix_key[:-3]
                    q_object &= Q(**{f"extra_data__{field_key}__lte": val})
                    continue

                parts = suffix_key.split("__")
                field_key = parts[0]
                lookup = parts[1] if len(parts) > 1 else None

                if lookup == "in" or ("," in val and not lookup):
                    values = [v.strip() for v in val.split(",") if v.strip()]
                    if values:
                        q_object &= Q(**{f"extra_data__{field_key}__in": values})
                elif lookup == "isnull":
                    is_null = val.lower() in ("true", "1", "yes")
                    q_object &= Q(**{f"extra_data__{field_key}__isnull": is_null})
                elif lookup and lookup in self.SAFE_LOOKUPS:
                    q_object &= Q(**{f"extra_data__{field_key}__{lookup}": val})
                elif val.lower() in ("true", "false"):
                    bool_val = val.lower() == "true"
                    q_object &= Q(**{f"extra_data__{field_key}": bool_val}) | Q(**{f"extra_data__{field_key}": val})
                else:
                    q_object &= Q(**{f"extra_data__{field_key}__icontains": val})
                continue

            # -------------------------------------------------------------
            # 2. Range shortcuts on model fields: *_min, *_max, *_from, *_to
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

                target_field = self._resolve_target_field(model, base_name)
                if target_field:
                    q_object &= Q(**{f"{target_field}__{op}": val})
                    continue

            # -------------------------------------------------------------
            # 3. Model Fields (either col__<field> or direct <field>)
            # -------------------------------------------------------------
            field_expr = raw_key[5:] if raw_key.startswith("col__") else raw_key
            parts = field_expr.split("__")

            lookup = None
            if len(parts) > 1 and parts[-1] in self.SAFE_LOOKUPS:
                lookup = parts.pop()

            field_path = "__".join(parts)
            resolved_path = self._resolve_target_field(model, field_path) or field_path
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

    def _resolve_target_field(self, model, base_name: str) -> str | None:
        """Resolves common filter shortcuts or exact field names to model fields."""
        FIELD_MAP = {
            "date": ["date", "quotation_date", "costing_date", "created_at"],
            "amount": ["grand_total", "subtotal", "supplier_cost", "client_revenue"],
            "grand_total": ["grand_total"],
            "subtotal": ["subtotal"],
            "profit": ["profit"],
            "created": ["created_at"],
            "created_at": ["created_at"],
            "client_name": ["client__client_name", "client_name"],
            "client": ["client__client_name", "client_name", "client"],
            "company_name": ["client__company__company_name", "company_name"],
            "company": ["client__company__company_name", "company_name", "company"],
            "supplier_name": ["supplier__supplier_name", "supplier_name"],
            "supplier": ["supplier__supplier_name", "supplier_name", "supplier"],
            "project_name": ["project__project_name", "project_name"],
            "project": ["project__project_name", "project_name", "project"],
            "product_name": ["product__product_name", "product_name"],
            "product": ["product__product_name", "product_name", "product"],
        }
        candidates = FIELD_MAP.get(base_name, [base_name])
        for c in candidates:
            if self._get_model_field(model, c) is not None:
                return c
        return None

