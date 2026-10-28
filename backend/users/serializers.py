from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .phone import InvalidPhone, looks_like_phone, normalize_phone

User = get_user_model()

INVALID_PHONE = "Numéro de téléphone invalide."


def clean_phone(value, region=None, exclude=None):
    """Normalized phone, unique among users (the unique check must run after normalizing)."""
    try:
        phone = normalize_phone(value, region)
    except InvalidPhone:
        raise serializers.ValidationError(INVALID_PHONE) from None
    others = User.objects.filter(phone=phone)
    if exclude is not None:
        others = others.exclude(pk=exclude.pk)
    if others.exists():
        raise serializers.ValidationError("Ce numéro est déjà utilisé.")
    return phone


def phone_region(serializer):
    """Country picked next to the phone field; sent as `phone_country`, not stored."""
    region = serializer.initial_data.get("phone_country") or None
    return region if isinstance(region, str) and len(region) == 2 else None


def clean_email(value, exclude=None):
    if not value:
        return None
    others = User.objects.filter(email__iexact=value)
    if exclude is not None:
        others = others.exclude(pk=exclude.pk)
    if others.exists():
        raise serializers.ValidationError("Cette adresse e-mail est déjà utilisée.")
    return value.lower()


class UserSerializer(serializers.ModelSerializer):
    # Declared explicitly so the model's UniqueValidator doesn't run on the raw, unnormalized value.
    phone = serializers.CharField(max_length=30)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    whatsapp_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "phone", "email", "whatsapp_verified", "currency", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_whatsapp_verified(self, user):
        return user.whatsapp_verified_at is not None

    def validate_phone(self, value):
        return clean_phone(value, phone_region(self), exclude=self.instance)

    def validate_email(self, value):
        return clean_email(value, exclude=self.instance)

    def update(self, instance, validated_data):
        if "phone" in validated_data and validated_data["phone"] != instance.phone:
            instance.whatsapp_verified_at = None  # a new number has to be verified again
        return super().update(instance, validated_data)


class RegisterSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(max_length=30)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "username", "phone", "email", "password", "currency"]
        read_only_fields = ["id"]

    def validate_phone(self, value):
        return clean_phone(value, phone_region(self))

    def validate_email(self, value):
        return clean_email(value)

    def validate(self, attrs):
        validate_password(
            attrs["password"], User(username=attrs["username"], email=attrs.get("email") or "")
        )
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class PhoneSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30)

    def validate_phone(self, value):
        try:
            return normalize_phone(value, phone_region(self))
        except InvalidPhone:
            raise serializers.ValidationError(INVALID_PHONE) from None


class PasswordResetSerializer(PhoneSerializer):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Le code a 6 chiffres."})
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField(help_text="Nom d'utilisateur, téléphone ou e-mail")
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        login = attrs["login"].strip()
        match = None
        if "@" in login:
            match = User.objects.filter(email__iexact=login).first()
        elif looks_like_phone(login):
            # No country picker on the login form: try each usual country in turn.
            for region in settings.PHONE_LOGIN_REGIONS:
                try:
                    match = User.objects.filter(phone=normalize_phone(login, region)).first()
                except InvalidPhone:
                    continue
                if match:
                    break
        if match:
            login = match.username
        user = authenticate(self.context.get("request"), username=login, password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Identifiants invalides.")
        attrs["user"] = user
        return attrs
