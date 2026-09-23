from django.core.management.base import BaseCommand
from apps.suppliers.models import Supplier, SupplierProduct
from apps.catalog.models import Product

class Command(BaseCommand):
    help = "Sync all supplier product names from product_details and linked items into the unified Product catalog"

    def handle(self, *args, **options):
        created_count = 0
        linked_count = 0
        suppliers = Supplier.objects.filter(is_deleted=False)
        
        for s in suppliers:
            details = s.product_details or ""
            names = [n.strip() for n in details.replace("\n", ",").split(",") if n.strip()]
            for name in names:
                prod = Product.objects.filter(
                    organization=s.organization,
                    product_name__iexact=name
                ).first()
                if not prod:
                    prod = Product.objects.create(
                        organization=s.organization,
                        product_name=name,
                        is_deleted=False
                    )
                    created_count += 1
                elif prod.is_deleted:
                    prod.is_deleted = False
                    prod.save(update_fields=["is_deleted"])
                
                sp, sp_created = SupplierProduct.objects.get_or_create(
                    supplier=s,
                    product=prod
                )
                if sp_created:
                    linked_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully synced: {created_count} new products created in Catalog, {linked_count} new supplier-product links created."
            )
        )
