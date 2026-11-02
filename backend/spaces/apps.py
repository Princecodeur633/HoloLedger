from django.apps import AppConfig


class SpacesConfig(AppConfig):
    name = "spaces"
    verbose_name = "Espaces"

    def ready(self):
        from . import signals  # noqa: F401
