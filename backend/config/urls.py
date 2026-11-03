from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.clients.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.suppliers.urls")),
    path("api/", include("apps.projects.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.quotations.urls")),
    path("api/", include("apps.costing.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.organizations.urls")),
    path("api/", include("apps.reports.urls")),
]

from django.views.static import serve
from django.urls import re_path

urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    re_path(r"^uploads/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
