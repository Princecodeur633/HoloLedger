"""Best-effort parsing of Mobile Money confirmation SMS (MTN MoMo, Orange Money…)."""

import re
import unicodedata
from datetime import datetime

from .parsing import parse_amount

AMOUNT = r"(\d[\d\s .,]*\d|\d)\s*(?:FCFA|F\s?CFA|XAF|CFA|F\b)"
AMOUNT_PREFIXED = r"(?:FCFA|XAF)\s*(\d[\d\s .,]*\d|\d)"

INCOME_WORDS = ("recu", "received", "depot", "deposit", "credite", "credited", "vous a envoye")
WITHDRAWAL_WORDS = ("retrait", "withdraw", "cash out", "cashout")
EXPENSE_WORDS = (
    "paye",
    "paiement",
    "payment",
    "paid",
    "envoye",
    "transfert de",
    "transfer of",
    "sent",
    "achat",
    "debite",
    "debited",
    "facture",
)


def _plain(text):
    """Lowercase without accents, for keyword matching."""
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c)).lower()


def _amount_after(pattern, text):
    match = re.search(pattern + r"\s*:?\s*" + AMOUNT, text, re.IGNORECASE)
    return (parse_amount(match.group(1)), match.span()) if match else (None, None)


def parse_sms(text):
    plain = _plain(text)
    fee, fee_span = _amount_after(r"(?:frais|fees?|commission)(?:\s+de\s+\w+)?", plain)
    balance, balance_span = _amount_after(r"(?:nouveau\s+solde|new\s+balance|solde|balance)", plain)

    amount = None
    for match in list(re.finditer(AMOUNT, plain, re.IGNORECASE)) + list(
        re.finditer(AMOUNT_PREFIXED, plain, re.IGNORECASE)
    ):
        inside = lambda span: span and span[0] <= match.start() < span[1]  # noqa: E731
        if inside(fee_span) or inside(balance_span):
            continue
        amount = parse_amount(match.group(1))
        if amount:
            break

    if any(word in plain for word in INCOME_WORDS):
        kind = "income"
    elif any(word in plain for word in WITHDRAWAL_WORDS):
        kind = "withdrawal"
    elif any(word in plain for word in EXPENSE_WORDS):
        kind = "expense"
    else:
        kind = None

    found_date = None
    for pattern, fmt in ((r"\d{4}-\d{2}-\d{2}", "%Y-%m-%d"), (r"\d{2}/\d{2}/\d{4}", "%d/%m/%Y")):
        match = re.search(pattern, text)
        if match:
            try:
                found_date = datetime.strptime(match.group(0), fmt).date()
                break
            except ValueError:
                pass

    counterparty = None
    match = re.search(
        r"\b(?:a|à|de|vers|to|from|chez)\s+([A-ZÀ-Ý][\wÀ-ÿ'’.-]*(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'’.-]*){0,4})",
        text,
    )
    if match:
        counterparty = match.group(1).strip(" .")

    reference = None
    match = re.search(
        r"(?:transaction\s*id|id\s*(?:de\s*)?transaction|txn\s*id|ref(?:erence)?)\s*[:#]?\s*([A-Z0-9.\-]{4,})",
        text,
        re.IGNORECASE,
    )
    if match:
        reference = match.group(1).rstrip(".-")

    operator = "mtn" if re.search(r"momo|mtn", plain) else "orange" if "orange" in plain else None

    return {
        "kind": kind,
        "amount": abs(amount) if amount else None,
        "fee": fee,
        "balance": balance,
        "date": found_date,
        "counterparty": counterparty,
        "reference": reference,
        "operator": operator,
    }
