from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.response import Response

from spaces.scoping import SpaceScopedMixin

from .models import Category
from .serializers import CategorySerializer


class CategoryViewSet(SpaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    filterset_fields = ["type"]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Category.objects.filter(space=self.get_space())


    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cette catégorie est utilisée par des opérations et ne peut pas être supprimée."},
                status=status.HTTP_409_CONFLICT,
            )
