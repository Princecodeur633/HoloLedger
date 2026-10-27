from django.contrib import admin

from .models import Budget


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ["category", "amount", "alert_threshold", "user"]
    search_fields = ["category__name", "user__username"]
