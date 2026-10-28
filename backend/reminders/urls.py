from django.urls import path

from .views import DailyReminderCronView, PushStatusView, SubscribeView, UnsubscribeView

urlpatterns = [
    path("push/", PushStatusView.as_view(), name="push-status"),
    path("push/subscribe/", SubscribeView.as_view(), name="push-subscribe"),
    path("push/unsubscribe/", UnsubscribeView.as_view(), name="push-unsubscribe"),
    path("cron/daily/", DailyReminderCronView.as_view(), name="reminders-cron"),
]
