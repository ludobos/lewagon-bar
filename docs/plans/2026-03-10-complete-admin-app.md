# Compléter l'app admin Le Wagon

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compléter les pages manquantes de l'app de pilotage du bar (dashboard, caisse, assistant, placeholders) et la config.

**Architecture:** App Next.js 14 existante à la racine. On ajoute 7 fichiers. Pas de nouvelle dépendance (on retire recharts). CSS pur pour les barres du dashboard.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, @vercel/postgres, next-auth, Anthropic SDK

---

### Task 1: next.config.ts + .env.example

**Files:**
- Create: `next.config.ts`
- Create: `.env.example`

**Step 1:** Créer `next.config.ts` minimal — juste les images domains si besoin.

**Step 2:** Créer `.env.example` avec toutes les variables :
- ADMIN_PASSWORD, NEXTAUTH_SECRET, NEXTAUTH_URL
- POSTGRES_URL (Vercel Postgres)
- SUMUP_CLIENT_ID, SUMUP_CLIENT_SECRET, SUMUP_REDIRECT_URI
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
- INVOICE_SENDERS
- ANTHROPIC_API_KEY
- CRON_SECRET

**Step 3:** Retirer `recharts` du package.json (on fait les barres en CSS).

**Step 4:** Commit.

---

### Task 2: app/admin/dashboard/page.tsx

**Files:**
- Create: `app/admin/dashboard/page.tsx`

**Utilise:** `lib/db/transactions.ts` (getRevenueStats, getDailyRevenue)

**Contenu:**
- 3 cartes KPI en haut : CA moyen/jour (vs objectif 1750€), CA du mois projeté, tracker emprunt 730€/mois
- Couleur verte si >= objectif, rouge sinon
- Section "21 derniers jours" : liste avec mini-barres CSS (largeur proportionnelle au CA max)
- Chaque ligne : date + montant + barre
- Server component (pas de 'use client') — les données viennent de la DB directement

**Step 1:** Créer le fichier avec les 3 KPIs et la liste 21 jours.

**Step 2:** Commit.

---

### Task 3: app/admin/caisse/page.tsx

**Files:**
- Create: `app/admin/caisse/page.tsx`
- Create: `app/api/transactions/route.ts` (POST pour saisie manuelle)

**Contenu:**
- Liste des transactions du mois en cours (scrollable)
- Bouton "Ajouter une vente" → formulaire inline : montant (gros input), date (pré-remplie aujourd'hui), toggle CB/Espèces/Autre
- POST vers `/api/transactions` puis refresh
- Client component (formulaire interactif)

**Step 1:** Créer l'API route POST `/api/transactions`.

**Step 2:** Créer la page caisse.

**Step 3:** Commit.

---

### Task 4: app/admin/assistant/page.tsx

**Files:**
- Create: `app/admin/assistant/page.tsx`

**Utilise:** `/api/chat` (existe déjà, POST avec messages[])

**Contenu:**
- Chat simple : liste de messages + input en bas
- François tape sa question, Claude répond avec les données du bar
- Messages affichés en bulles (user à droite amber, assistant à gauche stone)
- Client component

**Step 1:** Créer la page chat fonctionnelle.

**Step 2:** Commit.

---

### Task 5: Placeholders factures + export

**Files:**
- Create: `app/admin/factures/page.tsx`
- Create: `app/admin/export/page.tsx`

**Contenu:** Page simple "Bientôt disponible" avec icône et texte.

**Step 1:** Créer les 2 placeholders.

**Step 2:** Commit.

---

### Task 6: Nettoyage final

- Vérifier que `npm run build` passe
- Vérifier les imports
