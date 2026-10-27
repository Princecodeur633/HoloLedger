from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import default_account


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def seed_default_account(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        default_account(instance)
