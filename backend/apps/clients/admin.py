from django.contrib import admin

from .models import Client, Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("company_name", "country", "city", "contact_email", "is_deleted")
    search_fields = ("company_name", "contact_email")
    list_filter = ("country", "is_deleted")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("client_name", "client_type", "company", "country", "phone", "is_deleted")
    search_fields = ("client_name", "phone", "email")
    list_filter = ("client_type", "country", "is_deleted")
