import phonenumbers
from django.conf import settings


class InvalidPhone(ValueError):
    pass


def normalize_phone(value: str, region: str | None = None) -> str:
    """Return the E.164 form (+242061234567) of a number typed in any common format.

    Numbers without "+<country code>" are read as numbers of `region` (ISO code, e.g. "CD"),
    PHONE_DEFAULT_REGION by default. The library knows each country's rules, such as the
    leading 0 that is dropped in DRC (0991… → +243991…) but kept in Congo (06… → +24206…).
    """
    try:
        number = phonenumbers.parse(value, (region or settings.PHONE_DEFAULT_REGION).upper())
    except phonenumbers.NumberParseException as exc:
        raise InvalidPhone(value) from exc
    if not phonenumbers.is_valid_number(number):
        raise InvalidPhone(value)
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def looks_like_phone(value: str) -> bool:
    digits = [c for c in value if c.isdigit()]
    return len(digits) >= 6 and all(c.isdigit() or c in "+ .-()" for c in value.strip())
