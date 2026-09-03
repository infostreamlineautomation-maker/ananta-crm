from django.contrib import admin

from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "client", "status", "is_deleted")
    list_filter = ("status", "is_deleted")
    search_fields = ("name", "client__client_name")
