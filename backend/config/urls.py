from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import AccountViewSet, TransferViewSet
from budgets.views import BudgetViewSet
from categories.views import CategoryViewSet
from goals.views import GoalContributionViewSet, GoalViewSet
from imports.views import CommitView, PreviewView, SmsView
from recurring.views import RecurringRuleViewSet
from transactions.stats import CategoryStatsView, InsightsView, PeriodStatsView, SummaryView
from transactions.views import TransactionViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("transactions", TransactionViewSet, basename="transaction")
router.register("accounts", AccountViewSet, basename="account")
router.register("transfers", TransferViewSet, basename="transfer")
router.register("budgets", BudgetViewSet, basename="budget")
router.register("goals", GoalViewSet, basename="goal")
router.register("goal-contributions", GoalContributionViewSet, basename="goal-contribution")
router.register("recurring", RecurringRuleViewSet, basename="recurring")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/reminders/", include("reminders.urls")),
    path("api/stats/summary/", SummaryView.as_view(), name="stats-summary"),
    path("api/stats/period/", PeriodStatsView.as_view(), name="stats-period"),
    path("api/stats/categories/", CategoryStatsView.as_view(), name="stats-categories"),
    path("api/stats/insights/", InsightsView.as_view(), name="stats-insights"),
    path("api/imports/preview/", PreviewView.as_view(), name="import-preview"),
    path("api/imports/commit/", CommitView.as_view(), name="import-commit"),
    path("api/imports/sms/", SmsView.as_view(), name="import-sms"),
    path("api/", include(router.urls)),
]
