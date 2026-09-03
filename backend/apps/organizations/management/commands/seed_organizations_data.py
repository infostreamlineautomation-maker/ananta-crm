"""Second-pass seed, run after every app's `organization` FK column actually
exists: attaches Meewa's real logo, seeds its starter product catalog, and
gives the initial admin/staff accounts access to the right organizations.

    python manage.py seed_organizations_data
"""

import os

from django.core.files import File
from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.catalog.models import Product
from apps.organizations.models import Organization, OrganizationMembership

MEEWA_LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tmp_seed", "meewa_logo.png")

MEEWA_PRODUCTS = [
    "Paper Cups - Single Wall",
    "Paper Cups - Double Wall",
    "Paper Cups - Ripple Wall",
    "Sugarcane Bagasse Plates",
    "Sugarcane Bagasse Bowls",
    "Paper Bowls with Lids",
    "Food Containers with Lids",
]


class Command(BaseCommand):
    help = "Seed Meewa's logo/catalog and organization memberships for the seeded users."

    def handle(self, *args, **options):
        ananta = Organization.objects.get(slug="ananta")
        meewa = Organization.objects.get(slug="meewa")

        if not meewa.logo and os.path.exists(MEEWA_LOGO_PATH):
            with open(MEEWA_LOGO_PATH, "rb") as f:
                meewa.logo.save("meewa_logo.png", File(f), save=True)
            self.stdout.write("Attached Meewa logo")

        created = 0
        for name in MEEWA_PRODUCTS:
            _, was_created = Product.objects.get_or_create(product_name=name, organization=meewa)
            created += was_created
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(MEEWA_PRODUCTS)} Meewa products ({created} newly created)"))

        admin_user = User.objects.filter(username="admin").first()
        if admin_user:
            OrganizationMembership.objects.get_or_create(user=admin_user, organization=ananta)
            OrganizationMembership.objects.get_or_create(user=admin_user, organization=meewa)
            self.stdout.write(self.style.SUCCESS("admin can access both organizations"))

        staff_user = User.objects.filter(username="staff1").first()
        if staff_user:
            OrganizationMembership.objects.get_or_create(user=staff_user, organization=ananta)
            self.stdout.write(self.style.SUCCESS("staff1 can access Ananta Graphics"))
