from rest_framework import serializers

from .models import Category


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "type", "color", "icon", "is_default", "created_at"]
        read_only_fields = ["id", "is_default", "created_at"]

    def validate(self, attrs):
        user = self.context["request"].user
        name = attrs.get("name", getattr(self.instance, "name", None))
        type_ = attrs.get("type", getattr(self.instance, "type", None))
        duplicates = Category.objects.filter(user=user, name__iexact=name, type=type_)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError({"name": "Une catégorie avec ce nom existe déjà."})
        return attrs
