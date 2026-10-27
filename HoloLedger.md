# 💰 Carnet — Gestion simple des revenus et dépenses

**HoloLedger** est une application web de gestion financière personnelle, simple, rapide et claire.  
Elle permet d’enregistrer manuellement ses **revenus** et ses **dépenses**, puis de suivre automatiquement son solde par jour, semaine, mois, trimestre, semestre et année.

L’objectif est de proposer une alternative moderne au carnet de caisse papier : l’utilisateur enregistre une opération en quelques secondes et comprend immédiatement où va son argent.

---

## 🎯 Objectif du projet

Aider une personne à :

- Enregistrer facilement ses revenus et dépenses.
- Connaître son solde disponible.
- Suivre ses entrées et sorties d’argent dans le temps.
- Identifier ses principales catégories de dépenses.
- Visualiser son évolution financière par période.
- Garder un historique clair de toutes ses opérations.

L’application ne cherche pas à remplacer une comptabilité professionnelle.  
Elle se concentre sur la simplicité, la rapidité de saisie et la lisibilité des informations financières.

---

## ✨ Fonctionnalités principales

### Gestion des opérations

- Ajouter une dépense.
- Ajouter un revenu.
- Modifier une opération.
- Supprimer une opération.
- Consulter l’historique des opérations.
- Rechercher une opération par description, catégorie ou montant.
- Filtrer les opérations par période.

### Catégories

- Catégories de dépenses par défaut : alimentation, transport, loyer, factures, santé, éducation, divertissement, famille, etc.
- Catégories de revenus par défaut : salaire, freelance, vente, cadeau, remboursement, autre.
- Possibilité de créer des catégories personnalisées.
- Attribution d’une couleur et d’une icône à chaque catégorie.

### Suivi financier

- Calcul automatique du solde.
- Total des revenus.
- Total des dépenses.
- Résultat net : revenus moins dépenses.
- Suivi par jour.
- Suivi par semaine.
- Suivi par mois.
- Suivi par trimestre.
- Suivi par semestre.
- Suivi par année.
- Répartition des dépenses par catégorie.

### Tableau de bord

- Solde actuel.
- Revenus du mois.
- Dépenses du mois.
- Résultat du mois.
- Dernières opérations enregistrées.
- Graphique simple revenus vs dépenses.
- Top des catégories de dépenses.

---

## 🧭 Expérience utilisateur

L’application est pensée mobile-first.

Le parcours principal est volontairement très court :

1. L’utilisateur ouvre l’application.
2. Il voit immédiatement son solde et ses statistiques du mois.
3. Il clique sur **Ajouter une opération**.
4. Il choisit **Dépense** ou **Revenu**.
5. Il saisit le montant.
6. Il choisit une catégorie.
7. Il enregistre.

La date est pré-remplie avec la date du jour afin d’accélérer la saisie.

### Exemple de formulaire

```text
Type : [ - Dépense ] [ + Revenu ]

Montant : 15 000 FCFA

Catégorie : Alimentation

Date : 26/10/2026

Description : Marché

Moyen de paiement : Espèces

[ Enregistrer ]
```

---

## 🧱 Modèle de données

### Table `users`

Représente un utilisateur de l’application.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant unique |
| username | string | Nom d’utilisateur |
| email | email | Adresse e-mail |
| password | string | Mot de passe hashé |
| created_at | datetime | Date de création |

### Table `categories`

Représente les catégories de revenus et de dépenses.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant unique |
| user_id | UUID | Propriétaire de la catégorie |
| name | string | Nom de la catégorie |
| type | string | `income`, `expense` ou `both` |
| color | string | Couleur associée |
| icon | string | Icône associée |
| is_default | boolean | Catégorie fournie par défaut |
| created_at | datetime | Date de création |

### Table `transactions`

Représente une opération financière : revenu ou dépense.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant unique |
| user_id | UUID | Propriétaire de l’opération |
| type | string | `income` ou `expense` |
| amount | decimal | Montant positif |
| currency | string | Devise, par défaut `XAF` |
| date | date | Date réelle de l’opération |
| description | string | Description courte |
| category_id | UUID | Catégorie associée |
| source | string | Provenance du revenu ou destination de la dépense |
| payment_method | string | Espèces, Mobile Money, carte, virement, etc. |
| note | text | Note facultative |
| created_at | datetime | Date de création |
| updated_at | datetime | Date de dernière modification |

> Les périodes — jour, semaine, mois, trimestre, semestre et année — ne sont pas stockées en base. Elles sont calculées à partir du champ `date`.

---

## 🧮 Logique de calcul

Le solde est calculé ainsi :

```text
Solde = Total des revenus - Total des dépenses
```

Pour une période donnée :

```text
Revenus de la période
- Dépenses de la période
= Résultat de la période
```

Exemple :

| Élément | Montant |
|---|---:|
| Revenus du mois | 450 000 FCFA |
| Dépenses du mois | 210 000 FCFA |
| Solde du mois | +240 000 FCFA |

---

## 🗓️ Périodes gérées

| Période | Définition |
|---|---|
| Jour | Une date précise |
| Semaine | Du lundi au dimanche |
| Mois | Du premier au dernier jour du mois |
| Trimestre | Janvier-mars, avril-juin, juillet-septembre, octobre-décembre |
| Semestre | Janvier-juin, juillet-décembre |
| Année | Du 1er janvier au 31 décembre |

---

## 🏗️ Architecture technique

### Frontend

| Élément | Technologie |
|---|---|
| Framework | Next.js avec App Router |
| Langage | TypeScript |
| Styles | Tailwind CSS |
| Composants UI | shadcn/ui |
| Graphiques | Recharts |
| Qualité du code | ESLint + Prettier |

### Backend

| Élément | Technologie |
|---|---|
| Framework | Django |
| API | Django REST Framework |
| Authentification | Django Auth |
| Base de données | PostgreSQL hébergée sur Neon |
| Versionnement | Git + GitHub |

### Schéma global

```text
Next.js Frontend
        |
        | Requêtes HTTP / JSON
        v
Django REST API
        |
        | ORM Django
        v
PostgreSQL sur Neon
```

---

## 📁 Structure suggérée du projet

```text
carnet/
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── transactions/new/
│   │   ├── reports/
│   │   └── settings/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── TransactionForm.tsx
│   │   ├── TransactionList.tsx
│   │   ├── BalanceCard.tsx
│   │   ├── PeriodSelector.tsx
│   │   └── CategoryBadge.tsx
│   │
│   ├── lib/
│   │   ├── api.ts
│   │   ├── dates.ts
│   │   ├── format.ts
│   │   └── types.ts
│   │
│   └── package.json
│
├── backend/
│   ├── config/
│   ├── users/
│   ├── categories/
│   ├── transactions/
│   ├── manage.py
│   └── requirements.txt
│
└── README.md
```

---

## 🔌 Principales routes API

### Authentification

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register/` | Créer un compte |
| POST | `/api/auth/login/` | Connexion |
| POST | `/api/auth/logout/` | Déconnexion |
| GET | `/api/auth/me/` | Récupérer l’utilisateur connecté |

### Catégories

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/categories/` | Lister les catégories |
| POST | `/api/categories/` | Créer une catégorie |
| PATCH | `/api/categories/{id}/` | Modifier une catégorie |
| DELETE | `/api/categories/{id}/` | Supprimer une catégorie |

### Transactions

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/transactions/` | Lister les opérations |
| POST | `/api/transactions/` | Créer une opération |
| GET | `/api/transactions/{id}/` | Détail d’une opération |
| PATCH | `/api/transactions/{id}/` | Modifier une opération |
| DELETE | `/api/transactions/{id}/` | Supprimer une opération |

### Statistiques

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/stats/summary/` | Résumé global |
| GET | `/api/stats/period/` | Statistiques par période |
| GET | `/api/stats/categories/` | Répartition par catégorie |

Exemple de filtre :

```text
GET /api/stats/period/?period=month&date=2026-10-26
```

---

## 🎨 Pages principales

### 1. Tableau de bord

Affiche :

- Solde actuel.
- Revenus du mois.
- Dépenses du mois.
- Résultat du mois.
- Dernières opérations.
- Graphique des revenus et dépenses.

### 2. Ajouter une opération

Permet d’enregistrer rapidement :

- Une dépense.
- Un revenu.
- Le montant.
- La catégorie.
- La date.
- La description.
- Le moyen de paiement.

### 3. Historique

Affiche la liste chronologique des opérations avec :

- Date.
- Description.
- Catégorie.
- Montant.
- Type d’opération.
- Actions : modifier ou supprimer.

### 4. Rapports

Affiche :

- Sélecteur de période.
- Total des revenus.
- Total des dépenses.
- Solde de la période.
- Répartition par catégorie.
- Graphique d’évolution.

### 5. Paramètres

Permet de gérer :

- Le profil utilisateur.
- Les catégories personnalisées.
- La devise.
- La déconnexion.

---

## 🚀 Installation locale

### Prérequis

- Node.js 20 ou plus récent
- Python 3.11 ou plus récent
- PostgreSQL ou une base PostgreSQL Neon
- Git

### 1. Cloner le projet

```bash
git clone [https://github.com/ton-utilisateur/carnet.git](https://github.com/ton-utilisateur/carnet.git)
cd carnet
```

### 2. Configurer le backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
```

Sur Windows :

```bash
venv\Scripts\activate
```

Installer les dépendances :

```bash
pip install -r requirements.txt
```

Créer un fichier `.env` :

```env
SECRET_KEY=ta_cle_secrete
DEBUG=True
DATABASE_URL=postgresql://user:password@host:port/database
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

Appliquer les migrations :

```bash
python manage.py migrate
```

Créer un superutilisateur :

```bash
python manage.py createsuperuser
```

Lancer le serveur Django :

```bash
python manage.py runserver
```

Le backend est disponible sur :

```text
http://localhost:8000
```

### 3. Configurer le frontend

Dans un autre terminal :

```bash
cd frontend
npm install
```

Créer un fichier `.env.local` :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Lancer le frontend :

```bash
npm run dev
```

L’application est disponible sur :

```text
http://localhost:3000
```

---

## 🧪 Scripts utiles

### Frontend

```bash
npm run dev
```

Lance le serveur de développement Next.js.

```bash
npm run build
```

Crée une version de production.

```bash
npm run lint
```

Vérifie la qualité du code avec ESLint.

```bash
npm run format
```

Formate le code avec Prettier.

### Backend

```bash
python manage.py migrate
```

Applique les migrations de base de données.

```bash
python manage.py makemigrations
```

Crée les migrations après modification des modèles.

```bash
python manage.py runserver
```

Lance le serveur Django.

```bash
python manage.py createsuperuser
```

Crée un administrateur Django.

---

## 🔐 Sécurité

- Les mots de passe sont hashés par Django.
- Chaque utilisateur ne peut accéder qu’à ses propres transactions et catégories.
- Les routes API sensibles nécessitent une authentification.
- Les variables sensibles sont stockées dans `.env` et ne doivent jamais être commitées.
- Les requêtes CORS sont limitées aux domaines autorisés.

---

## 📈 Évolutions futures

Après le MVP, l’application pourra évoluer vers :

- Budgets mensuels par catégorie.
- Objectifs d’épargne.
- Alertes de dépassement de budget.
- Export CSV et PDF.
- Comptes multiples : espèces, Mobile Money, banque.
- Transferts entre comptes.
- Opérations récurrentes : loyer, salaire, abonnements.
- Import de relevés bancaires.
- Connexion Mobile Money.
- Application mobile avec PWA.
- Mode hors ligne.
- Statistiques avancées.
- Support multi-devises.

---

## 📌 Périmètre du MVP

Le MVP se limite volontairement à :

- Authentification simple.
- Création de catégories.
- Ajout de revenus et dépenses.
- Historique des opérations.
- Calcul du solde.
- Statistiques par période.
- Tableau de bord simple.
- Graphiques de base.

Les connexions bancaires, la synchronisation automatique, la comptabilité avancée et les intégrations fiscales ne font pas partie de cette première version.

---

## 👨‍💻 Auteur

Projet développé par **[Ton nom]**.  
Développeur web full-stack, spécialisé dans les applications web modernes avec Next.js, TypeScript, Django et PostgreSQL.

---

## 📄 Licence

Ce projet est sous licence **MIT**.