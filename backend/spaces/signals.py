from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .services import personal_space


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_personal_space(sender, instance, created, raw=False, **kwargs):
    """Every new user starts with their own space (categories and account included)."""
    if created and not raw:
        personal_space(instance)
