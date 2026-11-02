from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from spaces.services import personal_space
from transactions.models import Transaction

User = get_user_model()


class GroupTests(APITestCase):
    def setUp(self):
        self.chef = User.objects.create_user("chef", phone="+242061234567", password="pw")
        self.awa = User.objects.create_user("awa", phone="+242051234567", password="pw")
        self.today = timezone.localdate()

    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client

    def url(self, path, space):
        return f"/api/group/{path}?space={space}"

    def create_group(self, kind, amount="10000", start=None, **rules):
        space = self.as_(self.chef).post("/api/spaces/", {"kind": kind, "name": "Groupe"}, format="json").data
        self.as_(self.chef).patch(
            self.url("rules/", space["id"]),
            {
                "contribution_amount": amount,
                "frequency": "monthly",
                "start_date": str(start or self.today),
                **rules,
            },
            format="json",
        )
        return space["id"]

    def join(self, space, user):
        self.as_(self.chef).post(f"/api/spaces/{space}/invite/", {"phone": user.phone}, format="json")
        inv = self.as_(user).get("/api/invitations/").data[0]
        self.as_(user).post(f"/api/invitations/{inv['id']}/accept/")

    def board(self, space, user=None):
        return self.as_(user or self.chef).get(self.url("", space)).data

    def member(self, board, name):
        return next(m for m in board["members"] if m["name"] == name)

    def test_declare_validate_refuse(self):
        space = self.create_group("tontine")
        self.join(space, self.awa)
        awa = self.member(self.board(space), "awa")

        # Awa declares her payment, and copies it in her personal space.
        res = self.as_(self.awa).post(
            self.url("contributions/", space),
            {"member": awa["id"], "amount": "10000", "reference": "MP123", "record_in_personal": True},
            format="json",
        )
        self.assertEqual(res.data["status"], "pending")
        self.assertEqual(
            Transaction.objects.filter(space=personal_space(self.awa), amount=10000).count(), 1
        )
        board = self.board(space)
        self.assertEqual(board["pending_count"], 1)
        self.assertEqual(self.member(board, "awa")["statuses"][0], "pending")

        # Only a manager reviews; Awa can't declare for someone else.
        chef = self.member(board, "chef")
        url = f"/api/group/contributions/{res.data['id']}/validate/?space={space}"
        self.assertEqual(self.as_(self.awa).post(url).status_code, 403)
        res2 = self.as_(self.awa).post(
            self.url("contributions/", space), {"member": chef["id"], "amount": "1"}, format="json"
        )
        self.assertEqual(res2.status_code, 403)

        self.assertEqual(self.as_(self.chef).post(url).data["status"], "validated")
        self.assertEqual(self.member(self.board(space), "awa")["statuses"][0], "paid")

        # A refused declaration does not count.
        res = self.as_(self.awa).post(
            self.url("contributions/", space), {"member": awa["id"], "amount": "5000"}, format="json"
        )
        refuse = f"/api/group/contributions/{res.data['id']}/refuse/?space={space}"
        self.as_(self.chef).post(refuse, {"reason": "Pas reçu"}, format="json")
        self.assertEqual(self.member(self.board(space), "awa")["paid"], 10000)

    def test_carnet_member_late_penalty_and_takeover(self):
        start = self.today - timedelta(days=70)  # 3 monthly periods already due
        space = self.create_group("family", amount="5000", start=start, late_penalty="500")
        res = self.as_(self.chef).post(
            self.url("members/", space), {"name": "Tonton Jean", "phone": "05 999 9999", "phone_country": "CG"}, format="json"
        )
        self.assertEqual(res.status_code, 201, res.data)
        jean = res.data["id"]
        # The manager records a payment for him: validated at once.
        res = self.as_(self.chef).post(
            self.url("contributions/", space), {"member": jean, "amount": "5000"}, format="json"
        )
        self.assertEqual(res.data["status"], "validated")

        row = self.member(self.board(space), "Tonton Jean")
        self.assertEqual(row["statuses"][:3], ["paid", "late", "late"])
        self.assertEqual((row["arrears"], row["penalty"]), (10000, 1000))

        # Jean installs the app later: he takes over his "carnet" history.
        newcomer = User.objects.create_user("jean", phone="+242059999999", password="pw")
        self.join(space, newcomer)
        rows = self.board(space, newcomer)["members"]
        self.assertEqual(len([r for r in rows if r["paid"] == 5000]), 1)
        self.assertEqual(self.member(self.board(space), "Tonton Jean")["user"], str(newcomer.id))

    def test_advance_covers_next_periods(self):
        space = self.create_group("family", amount="5000")
        me = self.member(self.board(space), "chef")
        self.as_(self.chef).post(
            self.url("contributions/", space), {"member": me["id"], "amount": "15000"}, format="json"
        )
        row = self.member(self.board(space), "chef")
        self.assertEqual(row["advance"], 10000)
        self.assertTrue(all(s == "paid" for s in row["statuses"]))

    def test_tontine_order_payout_and_personal_income(self):
        space = self.create_group("tontine")
        self.join(space, self.awa)
        board = self.board(space)
        self.assertEqual([p["beneficiary"]["name"] for p in board["periods"]], ["chef", "awa"])
        for m in board["members"]:
            self.as_(self.chef).post(
                self.url("contributions/", space), {"member": m["id"], "amount": "10000"}, format="json"
            )
        self.assertEqual(self.board(space)["periods"][0]["collected"], 20000)

        res = self.as_(self.chef).post(self.url("payouts/", space), {"session": 1}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self.as_(self.chef).post(self.url("payouts/", space), {"session": 1}, format="json").status_code, 400)
        # The order can't be redrawn once a pot was handed out.
        self.assertEqual(self.as_(self.chef).post(self.url("members/shuffle/", space)).status_code, 400)
        self.assertEqual(self.board(space)["current_period"]["beneficiary"]["name"], "awa")

    def test_family_expenses_with_purpose_and_roles(self):
        space = self.create_group("family", amount="5000")
        self.join(space, self.awa)
        me = self.member(self.board(space), "chef")
        self.as_(self.chef).post(self.url("contributions/", space), {"member": me["id"], "amount": "20000"}, format="json")
        res = self.as_(self.chef).post(
            self.url("expenses/", space), {"amount": "8000", "purpose": "Santé de grand-mère"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.board(space)["totals"]["cash"], 12000)
        # Everyone sees what the money was used for; only managers record it.
        self.assertEqual(self.as_(self.awa).get(self.url("expenses/", space)).data[0]["purpose"], "Santé de grand-mère")
        self.assertEqual(
            self.as_(self.awa).post(self.url("expenses/", space), {"amount": "1", "purpose": "x"}, format="json").status_code,
            403,
        )
        # The creator names Awa manager: now she can record expenses.
        awa = self.member(self.board(space), "awa")
        self.as_(self.chef).post(self.url(f"members/{awa['id']}/role/", space), {"manager": True}, format="json")
        self.assertEqual(
            self.as_(self.awa).post(self.url("expenses/", space), {"amount": "1", "purpose": "Eau"}, format="json").status_code,
            201,
        )

    def test_outsiders_and_other_spaces_are_refused(self):
        space = self.create_group("tontine")
        self.assertEqual(self.as_(self.awa).get(self.url("", space)).status_code, 404)
        # The group API only works in a tontine / family space.
        self.assertEqual(self.as_(self.chef).get("/api/group/").status_code, 404)
