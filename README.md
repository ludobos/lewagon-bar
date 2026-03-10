# Le Wagon — App de pilotage

Bar à Papote et à Grignote · 22 quai de la Fosse, 44000 Nantes  
SARL BOSCU · bar.lewagon@gmail.com

---

## Setup en 5 étapes

### 1. Cloner et installer
```bash
git clone https://github.com/ludobos/lewagon-bar
cd lewagon-bar
npm install
```

### 2. Variables d'environnement
```bash
cp .env.example .env.local
# Remplir toutes les valeurs dans .env.local
```

### 3. Créer la base Vercel Postgres
```
1. Sur vercel.com → ton projet → Storage → Create Database → Postgres
2. Copier les variables POSTGRES_* dans .env.local
3. Aller sur l'onglet Query dans Vercel et coller le contenu de db/schema.sql
```

### 4. Connecter SumUp
```
1. Créer une app sur https://developer.sumup.com
2. Remplir SUMUP_CLIENT_ID et SUMUP_CLIENT_SECRET dans .env.local
3. Lancer l'app, aller sur /admin/dashboard
4. Cliquer "Connecter SumUp" → autoriser depuis le compte François
```

### 5. Connecter Gmail (bar.lewagon@gmail.com)
```
1. Google Cloud Console → activer Gmail API + Drive API
2. Créer OAuth2 credentials (Web app)
3. Remplir GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET
4. Aller sur /admin/factures → "Connecter Gmail"
5. Se connecter avec bar.lewagon@gmail.com
```

---

## Développement local
```bash
npm run dev
# → http://localhost:3000
# → Login: mot de passe défini dans ADMIN_PASSWORD
```

## Déploiement Vercel
```bash
git push origin main
# Vercel déploie automatiquement
```

---

## Architecture

```
app/
  admin/          → Section protégée (login requis)
    dashboard/    → KPIs + graphique CA
    caisse/       → Historique ventes + saisie manuelle
    factures/     → Factures fournisseurs
    assistant/    → Chat IA (Claude)
    export/       → Télécharger Excel/CSV pour Fiteco
  api/
    auth/         → NextAuth (login/logout)
    cron/         → SumUp sync (23h) + Gmail sync (8h)
    sumup/        → OAuth SumUp
    gmail/        → OAuth Google
    chat/         → Assistant IA
    export/       → Génération Excel/CSV
  login/          → Page de connexion

lib/
  sumup.ts        → Client SumUp API + sync
  gmail.ts        → Client Gmail + Drive + extraction IA
  db/
    transactions.ts
    invoices.ts

db/
  schema.sql      → Tables Vercel Postgres
```

---

## Crons automatiques
| Heure | Action |
|-------|--------|
| 23h00 | Sync SumUp → récupère les ventes du jour |
| 08h00 | Sync Gmail → lit les nouvelles factures |

---

## Coûts mensuels
| Service | Coût |
|---------|------|
| Vercel (hébergement + crons) | 0€ |
| Vercel Postgres | 0€ (free tier) |
| SumUp API | 0€ |
| Gmail + Drive API | 0€ |
| Claude AI (assistant + factures) | ~3-10€ |
| **Total** | **~3-10€/mois** |
