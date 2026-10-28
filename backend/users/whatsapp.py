"""WhatsApp Cloud API (Meta): only free traffic is used.

The user always writes first (from a wa.me link), and the app answers inside the 24 h
customer-service window, so no paid template message is ever sent.
"""

import hashlib
import hmac
import json
import logging
import urllib.request
from urllib.parse import quote

from django.conf import settings

logger = logging.getLogger(__name__)


def is_enabled() -> bool:
    return all(
        [
            settings.WHATSAPP_TOKEN,
            settings.WHATSAPP_PHONE_NUMBER_ID,
            settings.WHATSAPP_APP_SECRET,
            settings.WHATSAPP_VERIFY_TOKEN,
            settings.WHATSAPP_BUSINESS_NUMBER,
        ]
    )


def digits(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit())


def chat_link(text: str) -> str:
    """Opens WhatsApp on the app's number with `text` ready to send."""
    return f"https://wa.me/{digits(settings.WHATSAPP_BUSINESS_NUMBER)}?text={quote(text)}"


def valid_signature(body: bytes, header: str) -> bool:
    """Meta signs every webhook call with the app secret (X-Hub-Signature-256)."""
    expected = hmac.new(settings.WHATSAPP_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", header or "")


def send_text(to: str, body: str) -> bool:
    url = (
        f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}"
        f"/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": digits(to),
        "type": "text",
        "text": {"body": body},
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10):
            return True
    except Exception:
        logger.exception("WhatsApp message to %s failed", to)
        return False
