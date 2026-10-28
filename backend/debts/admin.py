from django.contrib import admin

from .models import Debt, DebtPayment


class DebtPaymentInline(admin.TabularInline):
    model = DebtPayment
    extra = 0


@admin.register(Debt)
class DebtAdmin(admin.ModelAdmin):
    list_display = ["person", "direction", "amount", "date", "due_date", "user"]
    list_filter = ["direction"]
    search_fields = ["person", "user__username"]
    inlines = [DebtPaymentInline]
