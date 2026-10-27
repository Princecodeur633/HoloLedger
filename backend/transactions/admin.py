from django.contrib import admin

from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["date", "type", "amount", "currency", "category", "description", "user"]
    list_filter = ["type", "payment_method", "date"]
    search_fields = ["description", "category__name", "user__username"]
    date_hierarchy = "date"
