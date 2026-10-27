from decimal import Decimal

from rest_framework.renderers import JSONRenderer
from rest_framework.utils.encoders import JSONEncoder


class DecimalAsStringEncoder(JSONEncoder):
    """Render every Decimal as a string, like serializer fields do, to keep amounts exact."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


class AppJSONRenderer(JSONRenderer):
    encoder_class = DecimalAsStringEncoder
