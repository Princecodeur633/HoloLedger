from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import create_default_categories


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def seed_default_categories(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        create_default_categories(instance)
