"""Seeds the two organizations this CRM install actually runs — Ananta
Graphics (printing) and Meewa Industries (food-grade export packaging).

    python manage.py seed_organizations

Just the Organization rows themselves (this has to run *before* other apps'
organization FK migrations can backfill against a real row). Run
seed_organizations_data afterwards for the logo, sample catalog, and user
memberships, once those FK columns actually exist.

Idempotent: safe to re-run, updates existing rows by slug rather than
duplicating them.
"""

from django.core.management.base import BaseCommand

from apps.organizations.models import Organization


class Command(BaseCommand):
    help = "Seed the Ananta and Meewa Organization rows."

    def handle(self, *args, **options):
        ananta, _ = Organization.objects.update_or_create(
            slug="ananta",
            defaults={
                "name": "Ananta Graphics",
                "primary_color": "#C31432",
                "tagline": "Precision Printing",
                "contact_email": "info@anantagraphics.com",
                "default_currency_code": "INR",
                "quotation_prefix": "QT-",
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Ananta Graphics org ready (id={ananta.id})"))

        meewa, _ = Organization.objects.update_or_create(
            slug="meewa",
            defaults={
                "name": "Meewa Industries",
                "primary_color": "#EE3050",
                "tagline": "Packaging Excellence Beyond the BORDER",
                "contact_email": "sales@meewaindustries.com",
                "contact_phone": "+91 99786 44533",
                "address": "LG-04, Hiral Arcade, Opp. New Court Athwalines, Surat 395 007, Gujarat, India",
                "default_currency_code": "INR",
                "quotation_prefix": "QT-",
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Meewa Industries org ready (id={meewa.id})"))
