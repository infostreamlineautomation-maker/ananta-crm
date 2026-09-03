from .models import Organization, OrganizationMembership


class OrganizationMiddleware:
    """Resolves `request.organization` for every request from the session's
    active_organization_id — the single source of truth every org-scoped
    viewset (see apps.core.viewsets.ModuleViewSet) filters and stamps
    records against. Must run after AuthenticationMiddleware.

    If the session has no active org yet, or points at one the user no
    longer has access to, falls back to the user's first available
    organization and persists that choice. Anonymous requests just get
    request.organization = None — views that need it enforce that via
    normal permission checks, same as any other auth requirement."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.organization = None
        user = getattr(request, "user", None)

        if user is not None and user.is_authenticated:
            available = _available_organizations(user)
            active_id = request.session.get("active_organization_id")

            org = None
            if active_id is not None:
                org = next((o for o in available if o.id == active_id), None)
            if org is None:
                org = available.first() if hasattr(available, "first") else (available[0] if available else None)
                if org is not None:
                    request.session["active_organization_id"] = org.id

            request.organization = org

        return self.get_response(request)


def _available_organizations(user):
    if user.is_superuser:
        return Organization.objects.all().order_by("name")
    org_ids = OrganizationMembership.objects.filter(user=user).values_list("organization_id", flat=True)
    return Organization.objects.filter(id__in=org_ids).order_by("name")


def user_can_access(user, organization_id) -> bool:
    if user.is_superuser:
        return Organization.objects.filter(id=organization_id).exists()
    return OrganizationMembership.objects.filter(user=user, organization_id=organization_id).exists()
