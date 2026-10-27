from django.db import transaction as db_transaction
from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account, default_account
from categories.models import Category
from transactions.models import Transaction

from .parsing import MAX_ROWS, ParseError, guess_mapping, normalize_row, read_table
from .sms import parse_sms
from .suggest import CategorySuggester


class PreviewView(APIView):
    """POST multipart `file` → headers, raw rows and a guessed column mapping."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"file": ["Aucun fichier envoyé."]}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded.size > 5 * 1024 * 1024:
            return Response({"file": ["Fichier trop volumineux (5 Mo max)."]}, status=400)
        try:
            headers, rows = read_table(uploaded)
        except ParseError as exc:
            return Response({"file": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"headers": headers, "rows": rows, "mapping": guess_mapping(headers)})


class MappingSerializer(serializers.Serializer):
    date = serializers.IntegerField(min_value=0)
    description = serializers.IntegerField(min_value=0, required=False)
    amount = serializers.IntegerField(min_value=0, required=False)
    debit = serializers.IntegerField(min_value=0, required=False)
    credit = serializers.IntegerField(min_value=0, required=False)


class OverrideSerializer(serializers.Serializer):
    skip = serializers.BooleanField(required=False)
    category = serializers.UUIDField(required=False)


class CommitSerializer(serializers.Serializer):
    account = serializers.UUIDField(required=False)
    mapping = MappingSerializer()
    rows = serializers.ListField(
        child=serializers.ListField(child=serializers.CharField(allow_blank=True)),
        max_length=MAX_ROWS,
    )
    overrides = serializers.DictField(child=OverrideSerializer(), required=False, default=dict)
    dry_run = serializers.BooleanField(default=True)


class CommitView(APIView):
    """Analyze (dry_run) or import mapped rows.

    Each analyzed row reports its normalized values, the suggested category and whether it
    looks like a duplicate of an existing operation. Duplicates and rows in error are skipped
    unless an override says `skip: false`.
    """

    def post(self, request):
        payload = CommitSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        user = request.user

        if data.get("account"):
            account = Account.objects.filter(user=user, pk=data["account"]).first()
            if not account:
                return Response({"account": ["Compte introuvable."]}, status=400)
        else:
            account = default_account(user)

        categories = {c.id: c for c in Category.objects.filter(user=user)}
        suggester = CategorySuggester(user)
        existing = set(
            Transaction.objects.filter(user=user, account=account).values_list(
                "date", "amount", "type"
            )
        )

        analyzed = []
        for index, row in enumerate(data["rows"]):
            item = {"index": index, "error": None, "duplicate": False}
            try:
                values = normalize_row(row, data["mapping"])
            except ParseError as exc:
                item.update(error=str(exc), skip=True)
                analyzed.append(item)
                continue
            type_ = "income" if values["amount"] > 0 else "expense"
            amount = abs(values["amount"])
            override = data["overrides"].get(str(index), {})
            category_id = override.get("category") or suggester.suggest(values["description"], type_)
            category = categories.get(category_id)
            if category is None or not category.accepts(type_):
                item["error"] = "Catégorie invalide pour ce type d'opération."
            item.update(
                date=values["date"],
                description=values["description"],
                type=type_,
                amount=amount,
                category=category_id,
                duplicate=(values["date"], amount, type_) in existing,
            )
            default_skip = bool(item["error"]) or item["duplicate"]
            item["skip"] = override.get("skip", default_skip) or bool(item["error"])
            analyzed.append(item)

        if data["dry_run"]:
            return Response({"account": account.id, "rows": analyzed})

        to_create = [
            Transaction(
                user=user,
                type=item["type"],
                amount=item["amount"],
                currency=user.currency,
                date=item["date"],
                description=item["description"],
                category=categories[item["category"]],
                account=account,
                payment_method=Transaction.PaymentMethod.TRANSFER
                if account.type == Account.Type.BANK
                else Transaction.PaymentMethod.MOBILE_MONEY
                if account.type == Account.Type.MOBILE_MONEY
                else Transaction.PaymentMethod.OTHER,
                source="Import",
            )
            for item in analyzed
            if not item["skip"]
        ]
        with db_transaction.atomic():
            Transaction.objects.bulk_create(to_create)
        return Response(
            {"created": len(to_create), "skipped": len(analyzed) - len(to_create)},
            status=status.HTTP_201_CREATED,
        )


class SmsSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000)


class SmsView(APIView):
    """POST {text} → fields extracted from a Mobile Money SMS, with suggestions."""

    def post(self, request):
        payload = SmsSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        parsed = parse_sms(payload.validated_data["text"])
        if not parsed["amount"]:
            return Response(
                {"text": ["Aucun montant trouvé dans ce message."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        account = None
        mobile_accounts = user.accounts.filter(type=Account.Type.MOBILE_MONEY, is_archived=False)
        if parsed["operator"]:
            keywords = {"mtn": ("mtn", "momo"), "orange": ("orange", "om")}[parsed["operator"]]
            account = next(
                (a for a in mobile_accounts if any(k in a.name.lower() for k in keywords)), None
            )
        account = account or mobile_accounts.first()

        category = None
        if parsed["kind"] in ("income", "expense"):
            category = CategorySuggester(user).suggest(parsed["counterparty"] or "", parsed["kind"])

        return Response(
            {
                **parsed,
                "suggested_account": account.id if account else None,
                "suggested_category": category,
            }
        )
