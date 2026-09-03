from django.utils import timezone
from rest_framework import viewsets
from rest_framework.response import Response

from apps.accounts.permissions import ModulePermission

from .models import ActivityLog


class ModuleViewSet(viewsets.ModelViewSet):
    """Base for every module-permission-checked viewset: wires up
    ModulePermission, scopes every query and stamps every new record to the
    active organization (see apps.organizations) whenever the model has one,
    stamps created_by/updated_by, and writes an ActivityLog row for every
    create/update/delete. Subclasses set `module_name`.

    A subclass that defines its own get_queryset() (several do, for extra
    filtering/select_related) must call super().get_queryset() to inherit
    the organization scoping — it isn't applied automatically in that case."""

    permission_classes = [ModulePermission]

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, "organization_id"):
            qs = qs.filter(organization=self.request.organization)
        return qs

    def perform_create(self, serializer):
        extra = {}
        model = serializer.Meta.model
        if hasattr(model, "created_by"):
            extra["created_by"] = self.request.user
        if hasattr(model, "organization_id"):
            extra["organization"] = self.request.organization
        instance = serializer.save(**extra)
        self._log("create", instance)

    def perform_update(self, serializer):
        # Deliberately does NOT re-stamp organization — a record's
        # organization is fixed at creation and never moves between
        # businesses via an edit.
        extra = {"updated_by": self.request.user} if hasattr(serializer.Meta.model, "updated_by") else {}
        instance = serializer.save(**extra)
        self._log("update", instance)

    def perform_destroy(self, instance):
        self._log("delete", instance)
        instance.delete()

    def _log(self, action, instance):
        ActivityLog.objects.create(
            user=self.request.user,
            module=getattr(self, "module_name", ""),
            object_id=str(self._log_object_id(instance)),
            action=action,
            details=self._log_details(instance),
        )

    def _log_object_id(self, instance):
        """Defaults to the instance's own pk. A viewset for a child record
        that belongs to some other module's detail page (e.g. SupplierContact
        shown on a Supplier's Activity Log tab) MUST override this to return
        the parent's id instead — otherwise this table's own auto-increment
        pk can coincidentally collide with an unrelated parent's id and
        pollute that parent's activity log with unrelated entries."""
        return instance.pk

    def _log_details(self, instance):
        return ""


class SoftDeleteModuleViewSet(ModuleViewSet):
    """Same as ModuleViewSet, but DELETE flips is_deleted instead of removing
    the row — matching (and now generalizing) the legacy suppliers/quotations/
    costings pattern instead of hard-deleting like the legacy clients/companies/
    products did."""

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("include_deleted") != "1":
            qs = qs.filter(is_deleted=False)
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["is_deleted", "deleted_at"])
        self._log("delete", instance)
        return Response(status=204)
