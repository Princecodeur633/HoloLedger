from django.contrib import admin

from .models import Account, Transfer


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["name", "type", "initial_balance", "is_archived", "user"]
    list_filter = ["type", "is_archived"]
    search_fields = ["name", "user__username"]


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = ["date", "from_account", "to_account", "amount", "fee", "user"]
    date_hierarchy = "date"
