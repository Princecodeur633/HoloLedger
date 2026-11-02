from .services import request_space


class SpaceScopedMixin:
    """ViewSet mixin: data of the current space only; created rows go into that space.

    `user` stays on each row as its author (shown as "payé par" in shared spaces).
    """

    def get_space(self):
        return request_space(self.request)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request and self.request.user.is_authenticated:
            context["space"] = self.get_space()
        return context

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, space=self.get_space())
