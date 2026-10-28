from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetStartView,
    RegisterView,
    WhatsAppStatusView,
    WhatsAppVerifyStartView,
    WhatsAppWebhookView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("password/", PasswordChangeView.as_view(), name="password-change"),
    path("password/reset/start/", PasswordResetStartView.as_view(), name="password-reset-start"),
    path("password/reset/", PasswordResetConfirmView.as_view(), name="password-reset"),
    path("whatsapp/", WhatsAppStatusView.as_view(), name="whatsapp-status"),
    path("whatsapp/verify/", WhatsAppVerifyStartView.as_view(), name="whatsapp-verify"),
    path("whatsapp/webhook/", WhatsAppWebhookView.as_view(), name="whatsapp-webhook"),
]
