import io
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from openpyxl import Workbook
from rest_framework.test import APITestCase

from transactions.models import Transaction

from .parsing import guess_mapping, parse_amount, parse_date
from .sms import parse_sms

User = get_user_model()


class ParsingTests(SimpleTestCase):
    def test_amounts(self):
        cases = {
            "15 000": "15000",
            "15 000 FCFA": "15000",
            "1.234,56": "1234.56",
            "1,234.56": "1234.56",
            "1.234.567": "1234567",
            "12,5": "12.5",
            "(500)": "-500",
            "500-": "-500",
            "-2 000": "-2000",
        }
        for raw, expected in cases.items():
            self.assertEqual(parse_amount(raw), Decimal(expected), raw)
        self.assertIsNone(parse_amount(""))

    def test_dates(self):
        for raw in ("26/10/2026", "2026-10-26", "26-10-2026", "26.10.2026", "26/10/26 10:42"):
            self.assertEqual(parse_date(raw), date(2026, 10, 26), raw)

    def test_guess_mapping(self):
        self.assertEqual(
            guess_mapping(["Date opération", "Libellé", "Débit", "Crédit", "Solde"]),
            {"date": 0, "description": 1, "debit": 2, "credit": 3},
        )
        self.assertEqual(
            guess_mapping(["Date", "Description", "Montant"]),
            {"date": 0, "description": 1, "amount": 2},
        )


class SmsTests(SimpleTestCase):
    def test_mtn_payment(self):
        sms = (
            "Vous avez payé 5 000 FCFA à BOUTIQUE MARIE le 2026-10-26 10:15:02. "
            "Frais 50 FCFA. Nouveau solde: 120 000 FCFA. Transaction Id: 87654321."
        )
        parsed = parse_sms(sms)
        self.assertEqual(parsed["kind"], "expense")
        self.assertEqual(parsed["amount"], Decimal("5000"))
        self.assertEqual(parsed["fee"], Decimal("50"))
        self.assertEqual(parsed["balance"], Decimal("120000"))
        self.assertEqual(parsed["date"], date(2026, 10, 26))
        self.assertEqual(parsed["counterparty"], "BOUTIQUE MARIE")
        self.assertEqual(parsed["reference"], "87654321")

    def test_orange_received_and_withdrawal(self):
        parsed = parse_sms("Orange Money: Vous avez reçu 20000 FCFA de Jean Dupont. Solde: 45000 FCFA")
        self.assertEqual((parsed["kind"], parsed["amount"], parsed["operator"]), ("income", Decimal("20000"), "orange"))
        parsed = parse_sms("Retrait de 15.000 FCFA effectué. Frais: 300 FCFA")
        self.assertEqual((parsed["kind"], parsed["amount"], parsed["fee"]), ("withdrawal", Decimal("15000"), Decimal("300")))


class ImportApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)

    def upload(self, name, content):
        return self.client.post(
            "/api/imports/preview/", {"file": SimpleUploadedFile(name, content)}, format="multipart"
        )

    def test_csv_preview_analyze_and_commit(self):
        csv_content = (
            "RELEVE DE COMPTE\n"
            "Date;Libellé;Débit;Crédit\n"
            "01/10/2026;VIREMENT SALAIRE OCTOBRE;;450 000\n"
            "03/10/2026;CARREFOUR MARKET;12 500;\n"
            "04/10/2026;PHARMACIE DU CENTRE;3 000;\n"
            "date invalide;???;1;\n"
        ).encode("cp1252")
        preview = self.upload("releve.csv", csv_content)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["headers"], ["Date", "Libellé", "Débit", "Crédit"])
        self.assertEqual(len(preview.data["rows"]), 4)

        body = {"mapping": preview.data["mapping"], "rows": preview.data["rows"]}
        analysis = self.client.post("/api/imports/commit/", body, format="json").data["rows"]
        categories = {c.id: c.name for c in self.user.categories.all()}
        self.assertEqual(categories[analysis[0]["category"]], "Salaire")
        self.assertEqual(categories[analysis[1]["category"]], "Alimentation")
        self.assertEqual(categories[analysis[2]["category"]], "Santé")
        self.assertTrue(analysis[3]["error"])

        res = self.client.post(
            "/api/imports/commit/",
            {**body, "dry_run": False, "overrides": {"2": {"skip": True}}},
            format="json",
        )
        self.assertEqual((res.data["created"], res.data["skipped"]), (2, 2))
        self.assertEqual(Transaction.objects.get(type="income").amount, Decimal("450000"))

        # Re-importing the same file flags everything as duplicate.
        analysis = self.client.post("/api/imports/commit/", body, format="json").data["rows"]
        self.assertEqual([r["duplicate"] for r in analysis[:2]], [True, True])

    def test_xlsx_preview(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["Date", "Description", "Montant"])
        sheet.append([date(2026, 10, 5), "Taxi", -1500])
        buffer = io.BytesIO()
        workbook.save(buffer)
        res = self.upload("releve.xlsx", buffer.getvalue())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["rows"], [["2026-10-05", "Taxi", "-1500"]])

    def test_rejects_unknown_format(self):
        self.assertEqual(self.upload("releve.pdf", b"%PDF").status_code, 400)

    def test_sms_endpoint_suggests_account_and_category(self):
        from accounts.models import Account

        momo = Account.objects.create(user=self.user, name="MTN MoMo", type="mobile_money")
        res = self.client.post(
            "/api/imports/sms/",
            {"text": "MTN MoMo: Vous avez payé 2 500 FCFA à PHARMACIE DU LAC. Frais 0 FCFA."},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["suggested_account"], momo.id)
        santé = self.user.categories.get(name="Santé")
        self.assertEqual(res.data["suggested_category"], santé.id)

        res = self.client.post("/api/imports/sms/", {"text": "Bonjour, rappel de rendez-vous."})
        self.assertEqual(res.status_code, 400)
