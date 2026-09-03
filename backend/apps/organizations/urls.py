from django.urls import path

from . import views

urlpatterns = [
    path("organizations/mine/", views.mine, name="organizations-mine"),
    path("organizations/switch/", views.switch, name="organizations-switch"),
    path("settings/", views.settings_view, name="app-settings"),
    path("settings/test-email/", views.test_email_view, name="settings-test-email"),
    path("communications/", views.communications_list_view, name="communications-list"),
    path("communications/log/", views.log_communication_view, name="communications-log"),
]
