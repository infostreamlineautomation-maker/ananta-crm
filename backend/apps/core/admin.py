from django.contrib import admin

from .models import ActivityLog, Country


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "currency_code", "currency_symbol")
    search_fields = ("code", "name", "currency_code")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "module", "object_id", "action", "user")
    list_filter = ("module", "action")
    readonly_fields = [f.name for f in ActivityLog._meta.fields]
