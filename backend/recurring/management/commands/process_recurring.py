from django.core.management.base import BaseCommand

from recurring.services import process_due_rules


class Command(BaseCommand):
    help = "Crée les occurrences échues des opérations récurrentes automatiques (à lancer chaque jour)."

    def handle(self, *args, **options):
        created = process_due_rules()
        self.stdout.write(self.style.SUCCESS(f"{len(created)} opération(s) créée(s)."))
