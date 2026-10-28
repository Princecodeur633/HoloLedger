from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, WhatsAppChallenge


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "phone", "whatsapp_verified_at", "email", "is_staff", "created_at"]
    search_fields = ["username", "phone", "email"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("HoloLedger", {"fields": ["phone", "whatsapp_verified_at", "currency"]}),
    )


@admin.register(WhatsAppChallenge)
class WhatsAppChallengeAdmin(admin.ModelAdmin):
    list_display = ["user", "purpose", "created_at", "confirmed_at", "used_at", "attempts"]
    list_filter = ["purpose"]
    readonly_fields = [f.name for f in WhatsAppChallenge._meta.fields]
