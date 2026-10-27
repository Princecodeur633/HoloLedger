from django.contrib import admin

from .models import Goal, GoalContribution


class GoalContributionInline(admin.TabularInline):
    model = GoalContribution
    extra = 0


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ["name", "target_amount", "deadline", "user"]
    search_fields = ["name", "user__username"]
    inlines = [GoalContributionInline]
