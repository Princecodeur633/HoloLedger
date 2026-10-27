from django.contrib import admin

from .models import RecurringRule


@admin.register(RecurringRule)
class RecurringRuleAdmin(admin.ModelAdmin):
    list_display = ["description", "type", "amount", "frequency", "next_date", "auto_confirm", "is_active", "user"]
    list_filter = ["type", "frequency", "auto_confirm", "is_active"]
