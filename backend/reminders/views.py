import hmac

from django.conf import settings
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import push
from .models import PushSubscription


class SubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)
    keys = serializers.DictField(child=serializers.CharField(max_length=255))

    def validate_keys(self, value):
        if not {"p256dh", "auth"} <= value.keys():
            raise serializers.ValidationError("Clés p256dh et auth requises.")
        return value


class PushStatusView(APIView):
    """Public key the browser needs to subscribe, and whether reminders are configured."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"enabled": push.is_enabled(), "public_key": settings.VAPID_PUBLIC_KEY})


class SubscribeView(APIView):
    def post(self, request):
        serializer = SubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # A browser keeps its endpoint across logins: it follows whoever subscribed last.
        PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={
                "user": request.user,
                "p256dh": data["keys"]["p256dh"],
                "auth": data["keys"]["auth"],
            },
        )
        return Response(status=status.HTTP_201_CREATED)


class UnsubscribeView(APIView):
    def post(self, request):
        PushSubscription.objects.filter(
            user=request.user, endpoint=request.data.get("endpoint", "")
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DailyReminderCronView(APIView):
    """Called once a day by Vercel Cron, which sends "Authorization: Bearer <CRON_SECRET>"."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        expected = f"Bearer {settings.CRON_SECRET}"
        given = request.headers.get("Authorization", "")
        if not settings.CRON_SECRET or not hmac.compare_digest(given, expected):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not push.is_enabled():
            return Response({"sent": 0, "detail": "VAPID non configuré."})
        return Response({"sent": push.send_daily_reminders()})
