# HoloLedger — Carnet

Gestion simple des revenus et dépenses. Spécification complète : [HoloLedger.md](HoloLedger.md).

- `backend/` — Django + Django REST Framework (auth par token, PostgreSQL Neon ou SQLite en local)
- `frontend/` — Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts

## Démarrage rapide

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (Linux/macOS : source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         # puis renseigner les valeurs ; sans DATABASE_URL → SQLite
python manage.py migrate
python manage.py runserver     # http://localhost:8000
python manage.py test          # tests
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev                    # http://localhost:3000
```

Scripts : `npm run build`, `npm run lint`, `npm run typecheck`, `npm run format`.

## API

Authentification par token : en-tête `Authorization: Token <clé>`. Les montants sont toujours renvoyés en chaîne décimale exacte.

| Route | Description |
|---|---|
| `POST /api/auth/register/` · `login/` · `logout/` | Authentification ; `login` accepte le nom d’utilisateur ou l’e-mail |
| `GET/PATCH /api/auth/me/` | Profil (nom, e-mail, devise) |
| `/api/categories/` | CRUD ; 15 catégories par défaut à l’inscription ; suppression refusée (409) si utilisée |
| `/api/accounts/` | Comptes (espèces, Mobile Money, banque…) avec solde calculé ; un compte « Espèces » est créé à l’inscription ; archivage plutôt que suppression s’il contient des opérations |
| `/api/transfers/` | Transferts entre comptes (ni dépense ni revenu) ; les frais deviennent une dépense « Frais » |
| `/api/transactions/` | CRUD paginé ; filtres `type`, `category`, `account`, `payment_method`, `date_from`, `date_to`, `period` + `date`, `min_amount`, `max_amount`, `search`, `ordering` |
| `GET /api/transactions/export/` | Export CSV (mêmes filtres), lisible par Excel |
| `/api/budgets/?date=…` | Budgets mensuels par catégorie, avec consommation et statut `ok` / `warning` / `over` |
| `/api/goals/` · `/api/goals/{id}/contributions/` | Objectifs d’épargne et versements (montant négatif = retrait) |
| `/api/recurring/` · `pending/` · `{id}/confirm/` · `{id}/skip/` | Opérations récurrentes, « à confirmer » ou automatiques |
| `POST /api/imports/preview/` → `POST /api/imports/commit/` | Import de relevé CSV/XLSX : aperçu + colonnes devinées, puis analyse (`dry_run`) et import (doublons et catégories proposées) |
| `POST /api/imports/sms/` | Lecture d’un SMS Mobile Money (montant, frais, tiers, date, référence) |
| `GET /api/stats/summary/` | Tableau de bord : soldes par compte, mois en cours, alertes de budget, échéances à confirmer |
| `GET /api/stats/period/` · `categories/` · `insights/` | Statistiques par période, répartition par catégorie, analyse avancée (comparaison, taux d’épargne, projection, évolution du solde) |

Périodes : `day`, `week` (lundi → dimanche), `month`, `quarter`, `semester`, `year`.

## Production

- Opérations récurrentes automatiques : elles sont créées à chaque ouverture du tableau de bord ; en production, lancez aussi chaque jour `python manage.py process_recurring` (cron).
- PWA / hors ligne : le service worker (`frontend/public/sw.js`) n’est actif qu’en production (`npm run build && npm start`). Les opérations saisies hors ligne sont envoyées au retour de la connexion.
- Les tests (`python manage.py test`) utilisent toujours une base SQLite en mémoire, jamais la base de `DATABASE_URL`.
