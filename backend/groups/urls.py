from django.urls import path

from . import views

urlpatterns = [
    path("", views.BoardView.as_view(), name="group-board"),
    path("rules/", views.RulesView.as_view(), name="group-rules"),
    path("members/", views.MembersView.as_view(), name="group-members"),
    path("members/shuffle/", views.ShuffleView.as_view(), name="group-shuffle"),
    path("members/<uuid:pk>/", views.MemberDetailView.as_view(), name="group-member"),
    path("members/<uuid:pk>/role/", views.MemberRoleView.as_view(), name="group-member-role"),
    path("contributions/", views.ContributionsView.as_view(), name="group-contributions"),
    path("contributions/<uuid:pk>/", views.ContributionDetailView.as_view(), name="group-contribution"),
    path(
        "contributions/<uuid:pk>/<str:decision>/",
        views.ContributionReviewView.as_view(),
        name="group-contribution-review",
    ),
    path("payouts/", views.PayoutsView.as_view(), name="group-payouts"),
    path("payouts/<uuid:pk>/", views.PayoutDetailView.as_view(), name="group-payout"),
    path("expenses/", views.ExpensesView.as_view(), name="group-expenses"),
    path("expenses/<uuid:pk>/", views.ExpenseDetailView.as_view(), name="group-expense"),
]
