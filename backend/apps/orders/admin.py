from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_no", "date", "client", "project", "delivery_status", "payment_status", "grand_total")
    list_filter = ("delivery_status", "payment_status")
    search_fields = ("order_no",)
    readonly_fields = ("order_no", "subtotal", "tax_amount", "grand_total")
    inlines = [OrderItemInline]
