"""Idempotent baseline seed: countries, and the two roles the app ships with
(Admin/Staff) with their permission matrix. Organizations (Ananta/Meewa) are
seeded separately by seed_organizations, since they need Role/RolePermission
to exist first for membership to mean anything.

    python manage.py seed_initial_data
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, RolePermission
from apps.accounts.permissions import sync_role_permissions
from apps.core.models import Country
from apps.core.modules import MODULES

COUNTRIES = [
    # code, name, currency_code, currency_symbol
    ("IN", "India", "INR", "₹"),
    ("US", "United States", "USD", "$"),
    ("GB", "United Kingdom", "GBP", "£"),
    ("AE", "United Arab Emirates", "AED", "د.إ"),
    ("CA", "Canada", "CAD", "$"),
    ("AU", "Australia", "AUD", "$"),
    ("DE", "Germany", "EUR", "€"),
    ("FR", "France", "EUR", "€"),
    ("IT", "Italy", "EUR", "€"),
    ("ES", "Spain", "EUR", "€"),
    ("NL", "Netherlands", "EUR", "€"),
    ("SG", "Singapore", "SGD", "$"),
    ("SA", "Saudi Arabia", "SAR", "﷼"),
    ("QA", "Qatar", "QAR", "﷼"),
    ("KW", "Kuwait", "KWD", "د.ك"),
    ("OM", "Oman", "OMR", "﷼"),
    ("BH", "Bahrain", "BHD", ".د.ب"),
    ("ZA", "South Africa", "ZAR", "R"),
    ("JP", "Japan", "JPY", "¥"),
    ("CN", "China", "CNY", "¥"),
    ("HK", "Hong Kong", "HKD", "$"),
    ("MY", "Malaysia", "MYR", "RM"),
    ("TH", "Thailand", "THB", "฿"),
    ("ID", "Indonesia", "IDR", "Rp"),
    ("NZ", "New Zealand", "NZD", "$"),
    ("IE", "Ireland", "EUR", "€"),
    ("CH", "Switzerland", "CHF", "CHF"),
    ("SE", "Sweden", "SEK", "kr"),
    ("NO", "Norway", "NOK", "kr"),
    ("DK", "Denmark", "DKK", "kr"),
    ("BE", "Belgium", "EUR", "€"),
    ("NG", "Nigeria", "NGN", "₦"),
    ("KE", "Kenya", "KES", "KSh"),
    ("BD", "Bangladesh", "BDT", "৳"),
    ("LK", "Sri Lanka", "LKR", "Rs"),
    ("NP", "Nepal", "NPR", "Rs"),
    ("PK", "Pakistan", "PKR", "Rs"),
    ("BR", "Brazil", "BRL", "R$"),
    ("MX", "Mexico", "MXN", "$"),
]

# Legacy admin/staff behavior, ported into the new matrix: staff could view+add
# orders (their own) but never delete; no access to Users/Settings/Reports/Costing.
STAFF_FULL_ACCESS_MODULES = ["clients", "companies", "catalog", "projects", "orders", "quotations", "notifications"]


class Command(BaseCommand):
    help = "Seed countries, default roles/permissions, and app settings."

    @transaction.atomic
    def handle(self, *args, **options):
        for code, name, currency_code, currency_symbol in COUNTRIES:
            Country.objects.update_or_create(
                code=code,
                defaults={"name": name, "currency_code": currency_code, "currency_symbol": currency_symbol},
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(COUNTRIES)} countries"))

        admin_role, _ = Role.objects.get_or_create(
            name="Admin", defaults={"is_system": True, "description": "Full access to every module."}
        )
        staff_role, _ = Role.objects.get_or_create(
            name="Staff", defaults={"is_system": True, "description": "Day-to-day order/quotation entry."}
        )

        sync_role_permissions()

        for module in MODULES:
            RolePermission.objects.update_or_create(
                role=admin_role, module=module, defaults={"can_view": True, "can_add": True, "can_edit": True, "can_delete": True}
            )
            can_view = can_add = module in STAFF_FULL_ACCESS_MODULES
            RolePermission.objects.update_or_create(
                role=staff_role,
                module=module,
                defaults={"can_view": can_view, "can_add": can_add, "can_edit": False, "can_delete": False},
            )
        self.stdout.write(self.style.SUCCESS("Seeded Admin (full access) and Staff (scoped) roles"))
