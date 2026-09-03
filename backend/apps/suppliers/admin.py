from django.contrib import admin

from .models import Supplier, SupplierContact, SupplierFile, SupplierProduct


class SupplierContactInline(admin.TabularInline):
    model = SupplierContact
    extra = 0


class SupplierProductInline(admin.TabularInline):
    model = SupplierProduct
    extra = 0


class SupplierFileInline(admin.TabularInline):
    model = SupplierFile
    extra = 0
    readonly_fields = ("file_size", "mime_type", "uploaded_at", "uploaded_by")


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("supplier_name", "contact", "email", "is_deleted")
    search_fields = ("supplier_name", "contact", "email")
    inlines = [SupplierContactInline, SupplierProductInline, SupplierFileInline]
