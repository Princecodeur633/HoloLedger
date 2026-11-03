from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Space
from .services import personal_space

User = get_user_model()


class SpacesTests(APITestCase):
    def setUp(self):
        self.awa = User.objects.create_user("awa", phone="+242061234567", password="pw")
        self.paul = User.objects.create_user("paul", phone="+242051234567", password="pw")
        self.today = str(timezone.localdate())

    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client

    def create_space(self, user, kind, name=""):
        res = self.as_(user).post("/api/spaces/", {"kind": kind, "name": name}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def invite_and_accept(self, space, inviter, invitee):
        res = self.as_(inviter).post(
            f"/api/spaces/{space['id']}/invite/", {"phone": invitee.phone}, format="json"
        )
        self.assertEqual(res.status_code, 201, res.data)
        received = self.as_(invitee).get("/api/invitations/").data
        self.assertEqual(len(received), 1)
        res = self.as_(invitee).post(f"/api/invitations/{received[0]['id']}/accept/")
        self.assertEqual(res.status_code, 200, res.data)
        return res.data

    def test_every_user_has_a_seeded_personal_space(self):
        spaces = self.as_(self.awa).get("/api/spaces/").data
        self.assertEqual([s["kind"] for s in spaces], ["personal"])
        self.assertEqual(spaces[0]["accounts"][0]["name"], "Espèces")
        self.assertEqual(spaces[0]["balance"], "0.00")

    def test_couple_invitation_and_shared_data(self):
        couple = self.create_space(self.awa, "couple")
        self.assertEqual(couple["accounts"][0]["name"], "Compte commun")
        self.invite_and_accept(couple, self.awa, self.paul)

        # Paul records an expense in the couple space; Awa sees it, with its author.
        cat = self.as_(self.paul).get(f"/api/categories/?space={couple['id']}").data
        courses = next(c for c in cat if c["name"] == "Courses")
        res = self.as_(self.paul).post(
            f"/api/transactions/?space={couple['id']}",
            {"type": "expense", "amount": "15000", "category": courses["id"], "date": self.today},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        listed = self.as_(self.awa).get(f"/api/transactions/?space={couple['id']}").data["results"]
        self.assertEqual(listed[0]["author"]["username"], "paul")

        summary = self.as_(self.awa).get(f"/api/stats/summary/?space={couple['id']}").data
        paul = next(m for m in summary["members"] if m["username"] == "paul")
        self.assertEqual(paul["expense"], 15000)
        # Nothing of it in Awa's personal space.
        self.assertEqual(self.as_(self.awa).get("/api/transactions/").data["count"], 0)

    def test_only_one_couple_and_two_people(self):
        couple = self.create_space(self.awa, "couple")
        res = self.as_(self.awa).post("/api/spaces/", {"kind": "couple"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.invite_and_accept(couple, self.awa, self.paul)
        third = User.objects.create_user("zoe", phone="+242061111111", password="pw")
        res = self.as_(self.awa).post(
            f"/api/spaces/{couple['id']}/invite/", {"phone": third.phone}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_business_alone_or_as_a_duo(self):
        shop = self.create_space(self.awa, "business", "Boutique Mama")
        self.assertEqual(shop["name"], "Boutique Mama")
        names = {c["name"] for c in self.as_(self.awa).get(f"/api/categories/?space={shop['id']}").data}
        self.assertIn("Ventes", names)
        self.create_space(self.awa, "business", "Business B")  # several businesses allowed
        self.invite_and_accept(shop, self.awa, self.paul)
        self.assertEqual(len(self.as_(self.paul).get("/api/spaces/").data), 2)

    def test_invitation_waits_for_sign_up(self):
        couple = self.create_space(self.awa, "couple")
        res = self.as_(self.awa).post(
            f"/api/spaces/{couple['id']}/invite/",
            {"phone": "06 999 9999", "phone_country": "CG"},
            format="json",
        )
        self.assertFalse(res.data["registered"])
        self.assertIn("wa.me/242069999999", res.data["whatsapp_url"])
        self.assertIn("register", res.data["whatsapp_url"])

        newcomer = User.objects.create_user("nina", phone="+242069999999", password="pw")
        self.assertEqual(len(self.as_(newcomer).get("/api/invitations/").data), 1)

    def test_leaving_keeps_the_space_for_the_other(self):
        couple = self.create_space(self.awa, "couple")
        self.invite_and_accept(couple, self.awa, self.paul)
        self.assertEqual(self.as_(self.awa).post(f"/api/spaces/{couple['id']}/leave/").status_code, 204)
        self.assertEqual(self.as_(self.awa).get(f"/api/transactions/?space={couple['id']}").status_code, 404)
        paul_spaces = self.as_(self.paul).get("/api/spaces/").data
        kept = next(s for s in paul_spaces if s["id"] == couple["id"])
        self.assertEqual(kept["role"], "owner")
        # Personal spaces can't be left or deleted.
        own = personal_space(self.awa)
        self.assertEqual(self.as_(self.awa).post(f"/api/spaces/{own.id}/leave/").status_code, 400)
        self.assertEqual(self.as_(self.awa).delete(f"/api/spaces/{own.id}/").status_code, 400)

    def test_spaces_never_mix(self):
        shop = self.create_space(self.awa, "business", "Boutique")
        # Paul is not a member: the space does not exist for him.
        for url in [f"/api/transactions/?space={shop['id']}", f"/api/spaces/{shop['id']}/"]:
            self.assertEqual(self.as_(self.paul).get(url).status_code, 404, url)
        # Awa can't file a shop expense under a personal category.
        personal_cat = self.awa.categories.filter(space__kind="personal", type="expense").first()
        res = self.as_(self.awa).post(
            f"/api/transactions/?space={shop['id']}",
            {"type": "expense", "amount": "1", "category": str(personal_cat.id), "date": self.today},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_transfer_between_two_spaces(self):
        couple = self.create_space(self.awa, "couple")
        own = personal_space(self.awa)
        cash = own.accounts.get()
        common = Space.objects.get(pk=couple["id"]).accounts.get()
        res = self.as_(self.awa).post(
            "/api/transfers/",
            {"from_account": str(cash.id), "to_account": str(common.id), "amount": "50000", "date": self.today},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["to_space"]["name"], "Couple")

        spaces = {s["kind"]: s for s in self.as_(self.awa).get("/api/spaces/").data}
        self.assertEqual(spaces["personal"]["balance"], "-50000.00")
        self.assertEqual(spaces["couple"]["balance"], "50000.00")
        # Not counted as income / expense in either space.
        summary = self.as_(self.awa).get(f"/api/stats/summary/?space={couple['id']}").data
        self.assertEqual((summary["month"]["income"], summary["balance"]), (0, 50000))
        # The receiving space sees it but only the sending one may cancel it.
        res = self.as_(self.awa).delete(f"/api/transfers/{res.data['id']}/?space={couple['id']}")
        self.assertEqual(res.status_code, 403)

        # Paul can't send money into Awa's personal account.
        paul_cash = personal_space(self.paul).accounts.get()
        res = self.as_(self.paul).post(
            "/api/transfers/",
            {"from_account": str(paul_cash.id), "to_account": str(cash.id), "amount": "1", "date": self.today},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_quarter_budget(self):
        own = personal_space(self.awa)
        food = own.categories.get(name="Alimentation")
        res = self.as_(self.awa).post(
            "/api/budgets/", {"category": str(food.id), "amount": "300000", "period": "quarter"}, format="json"
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["period"], "quarter")

    def test_notifications_across_spaces(self):
        couple = self.create_space(self.awa, "couple")
        self.as_(self.awa).post(f"/api/spaces/{couple['id']}/invite/", {"phone": self.paul.phone}, format="json")
        tontine = self.create_space(self.paul, "tontine", "Tontine")
        me = self.as_(self.paul).get(f"/api/group/?space={tontine['id']}").data["members"][0]
        self.as_(self.paul).post(
            f"/api/group/contributions/?space={tontine['id']}", {"member": me["id"], "amount": "5"}, format="json"
        )
        # Paul (manager) recorded it himself, so it's validated: nothing to validate.
        data = self.as_(self.paul).get("/api/notifications/").data
        texts = [i["text"] for i in data["items"]]
        self.assertIn("1 invitation à rejoindre un espace", texts)
        self.assertFalse(any("à valider" in t for t in texts))

