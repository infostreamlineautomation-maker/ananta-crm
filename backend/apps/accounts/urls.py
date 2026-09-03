from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("roles", views.RoleViewSet, basename="role")
router.register("users", views.UserViewSet, basename="user")

urlpatterns = [
    path("csrf/", views.csrf, name="csrf"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("me/", views.me, name="me"),
    path("", include(router.urls)),
]
