from django.core.management.base import BaseCommand
from apps.core.models import CustomFieldDefinition

DUPLICATE_BUILTIN_KEYS = [
    "client_name", "company", "company_name", "phone", "email", "address",
    "country", "country_name", "currency_code", "client_type", "group_ids",
    "order_no", "date", "supplier", "supplier_name", "grand_total", "subtotal",
    "quotation_no", "quotation_date", "product_name", "item_name"
]

class Command(BaseCommand):
    help = "Remove redundant CustomFieldDefinitions that duplicate built-in model fields."

    def handle(self, *args, **options):
        deleted_count, _ = CustomFieldDefinition.objects.filter(
            field_key__in=DUPLICATE_BUILTIN_KEYS
        ).delete()
        self.stdout.write(
            self.style.SUCCESS(f"Successfully cleaned up {deleted_count} duplicate custom field definitions.")
        )
