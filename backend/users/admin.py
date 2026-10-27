from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "currency", "is_staff", "created_at"]
    fieldsets = BaseUserAdmin.fieldsets + (("HoloLedger", {"fields": ["currency"]}),)
