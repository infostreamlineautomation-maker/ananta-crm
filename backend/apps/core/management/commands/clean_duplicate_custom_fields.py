"""Deletes auto-seeded duplicate standard fields from CustomFieldDefinition so that
only truly custom user-created fields remain.

    python manage.py clean_duplicate_custom_fields
"""

from django.core.management.base import BaseCommand
from apps.core.models import CustomFieldDefinition

# List of built-in field keys that were previously auto-seeded into CustomFieldDefinition
DUPLICATE_BUILTIN_KEYS = [
    # Supplier builtins
    "name", "contact_person", "phone", "email", "city", "state", "country", "address",
    "gstin", "pan_number", "bank_name", "bank_account_no", "bank_ifsc", "payment_terms",
    "material_categories", "credit_period_days",
    # Client builtins
    "client_name", "client_type", "company_name", "groups", "currency_code",
    "credit_limit", "sales_territory",
    # Company builtins
    "logo", "contact_name", "msin_number", "reg_no", "contact_email", "contact_phone",
    "company_phone", "zip_code", "branch_code", "facebook", "twitter", "linkedin", "remarks",
    # Product builtins
    "product_name", "description", "category", "standard_unit", "hsn_code",
    "min_order_qty", "standard_gsm", "base_price", "lead_time_days",
    # Order builtins
    "order_no", "project_title", "images", "date", "supplier_name", "delivery_time",
    "subtotal", "tax_percent", "tax_amount", "grand_total", "paid_amount", "due_amount",
    "delivery_status", "payment_status", "gsm", "paper_type", "size", "lamination", "colors", "finishing",
    # Quotation builtins
    "quotation_no", "quotation_date", "status", "to_name", "to_address", "subject", "intro_text",
    "total_amount", "notes", "material", "delivery_days",
    # Costing builtins
    "project_name", "file", "supplier", "product", "quantity", "supplier_rate", "client_rate",
    "supplier_cost", "client_revenue", "profit", "profit_percent", "paper_cost",
    "printing_charge", "lamination_cost", "die_finishing_cost", "wastage_percent", "machine_setup",
]


class Command(BaseCommand):
    help = "Remove auto-seeded standard field duplicates from CustomFieldDefinition."

    def handle(self, *args, **options):
        deleted_count, _ = CustomFieldDefinition.objects.filter(
            field_key__in=DUPLICATE_BUILTIN_KEYS
        ).delete()
        self.stdout.write(
            self.style.SUCCESS(f"Cleaned up {deleted_count} duplicate standard field definition(s).")
        )
