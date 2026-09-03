from django.contrib import admin

from .models import Costing, CostingItem


class CostingItemInline(admin.TabularInline):
    model = CostingItem
    extra = 0


@admin.register(Costing)
class CostingAdmin(admin.ModelAdmin):
    list_display = ("id", "costing_date", "project", "supplier", "product", "client")
    inlines = [CostingItemInline]
