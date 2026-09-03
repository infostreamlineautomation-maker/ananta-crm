from django.contrib import admin

from .models import Notification, NotificationRead


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("event_type", "title", "order", "created_at")
    list_filter = ("event_type",)


@admin.register(NotificationRead)
class NotificationReadAdmin(admin.ModelAdmin):
    list_display = ("user", "notification", "read_at", "is_dismissed")
