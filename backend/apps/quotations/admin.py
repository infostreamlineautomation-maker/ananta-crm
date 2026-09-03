from django.contrib import admin

from .models import Quotation, QuotationItem


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 0


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ("quotation_no", "quotation_date", "client", "project", "status", "currency_code")
    list_filter = ("status",)
    search_fields = ("quotation_no", "subject")
    readonly_fields = ("quotation_no",)
    inlines = [QuotationItemInline]
