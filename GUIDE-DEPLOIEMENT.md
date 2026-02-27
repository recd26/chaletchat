# 🚀 Guide de déploiement ChaletProp
**Stack : React + Vite · Supabase · Stripe · Vercel**

---

## 📋 Vue d'ensemble

```
Navigateur  ──►  React (Vercel)  ──►  Supabase (DB + Auth + Storage)
                                  ──►  Stripe (Paiements)
```

---

## ÉTAPE 1 — Prérequis (5 min)

Installez ces outils si ce n'est pas déjà fait :

```bash
# Node.js 18+ requis
node --version   # doit afficher v18 ou plus

# Installer les dépendances du projet
cd chaletchat
npm install
```

---

## ÉTAPE 2 — Créer votre projet Supabase (10 min)

### 2.1 Créer un compte et un projet

1. Allez sur **https://supabase.com** → "Start your project" → créez un compte
2. Cliquez **"New project"**
3. Donnez un nom : `chaletchat`
4. Choisissez un mot de passe fort pour la base de données (gardez-le !)
5. Région : `Canada (East)` → **"Create new project"**
6. Attendez ~2 minutes que le projet démarre

### 2.2 Récupérer vos clés API

Dans votre projet Supabase :
- Allez dans **Settings → API**
- Copiez :
  - `URL` (ex: `https://abcdef.supabase.co`)
  - `anon public` key (longue chaîne de caractères)

### 2.3 Créer la base de données

1. Dans Supabase, cliquez **SQL Editor** dans le menu gauche
2. Cliquez **"New query"**
3. Copiez-collez **tout le contenu** du fichier `src/lib/supabase-schema.sql`
4. Cliquez **"Run"** (▶)
5. Vérifiez que vous voyez "Success. No rows returned"

### 2.4 Activer l'authentification par courriel

1. Allez dans **Authentication → Providers**
2. **Email** : activez "Enable Email provider" ✅
3. Désactivez "Confirm email" pour les tests (réactivez en production)

### 2.5 Créer les buckets de stockage

Dans **Storage** → **New bucket** :

| Nom | Public ? | Usage |
|-----|----------|-------|
| `cleaning-photos` | ✅ Oui | Photos des pièces après ménage |
| `id-documents` | ❌ Non | Selfies et pièces d'identité |
| `avatars` | ✅ Oui | Photos de profil |

---

## ÉTAPE 3 — Configurer Stripe (15 min)

### 3.1 Créer un compte Stripe

1. Allez sur **https://stripe.com** → créez un compte
2. Restez en **mode test** (le curseur en haut à droite)

### 3.2 Récupérer votre clé publique

1. Allez dans **Developers → API keys**
2. Copiez la **Publishable key** (commence par `pk_test_...`)

### 3.3 Configurer Stripe Connect (pour payer les pros)

1. Allez dans **Connect → Settings**
2. Activez **Express accounts**
3. Configurez le pays : Canada
4. Notez votre **Secret key** (`sk_test_...`) — uniquement pour votre backend/edge functions

### 3.4 Créer l'Edge Function Supabase pour les paiements

Dans votre terminal :

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Lier à votre projet
supabase link --project-ref VOTRE_PROJECT_REF

# Créer la fonction de paiement
supabase functions new release-payment
```

Contenu de `supabase/functions/release-payment/index.ts` :

```typescript
import Stripe from 'https://esm.sh/stripe@14.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)

Deno.serve(async (req) => {
  const { requestId } = await req.json()

  // Récupérer la demande depuis Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data: request } = await supabase
    .from('cleaning_requests')
    .select('*, pro:profiles!assigned_pro_id(stripe_account_id)')
    .eq('id', requestId)
    .single()

  if (!request?.stripe_payment_intent_id) {
    return new Response('No payment intent', { status: 400 })
  }

  // Capturer le paiement et transférer au pro (moins 3%)
  await stripe.paymentIntents.capture(request.stripe_payment_intent_id)

  const platformFee = Math.round(request.agreed_price * 100 * 0.03)
  await stripe.transfers.create({
    amount: Math.round(request.agreed_price * 100) - platformFee,
    currency: 'cad',
    destination: request.pro.stripe_account_id,
  })

  // Mettre à jour le statut
  await supabase
    .from('cleaning_requests')
    .update({ payment_status: 'released' })
    .eq('id', requestId)

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Déployer la fonction :
```bash
supabase functions deploy release-payment \
  --env-file .env.production
```

---

## ÉTAPE 4 — Variables d'environnement (2 min)

### 4.1 Créer votre fichier `.env`

```bash
cp .env.example .env
```

### 4.2 Remplir avec vos vraies valeurs

```env
VITE_SUPABASE_URL=https://VOTRE_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...votre_cle_anon
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle_stripe
```

⚠️ **Ne jamais commiter `.env` sur GitHub** — il est déjà dans `.gitignore`

---

## ÉTAPE 5 — Tester en local (2 min)

```bash
npm run dev
```

Ouvrez **http://localhost:5173** et testez :
- ✅ Page d'accueil affiche le hero
- ✅ Inscription propriétaire (3 étapes)
- ✅ Inscription professionnelle (4 étapes + documents)
- ✅ Connexion
- ✅ Dashboard selon le rôle

---

## ÉTAPE 6 — Déployer sur Vercel (5 min)

### 6.1 Mettre sur GitHub

```bash
git init
git add .
git commit -m "feat: ChaletProp v1.0"
git branch -M main
git remote add origin https://github.com/VOTRE_USER/chaletchat.git
git push -u origin main
```

### 6.2 Importer sur Vercel

1. Allez sur **https://vercel.com** → "Add New Project"
2. Connectez votre compte GitHub
3. Sélectionnez le repo `chaletchat`
4. **Framework Preset** : Vite ✅ (détecté automatiquement)
5. **Build Command** : `npm run build`
6. **Output Directory** : `dist`

### 6.3 Ajouter les variables d'environnement sur Vercel

Dans **Settings → Environment Variables**, ajoutez :

| Variable | Valeur |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |

7. Cliquez **"Deploy"** → votre app sera en ligne en ~90 secondes !

### 6.4 Configurer le domaine Supabase

Dans Supabase → **Authentication → URL Configuration** :
- **Site URL** : `https://chaletchat.vercel.app` (votre vrai URL Vercel)
- **Redirect URLs** : `https://chaletchat.vercel.app/**`

---

## ÉTAPE 7 — Avant de lancer (checklist production)

- [ ] Réactiver "Confirm email" dans Supabase Auth
- [ ] Passer Stripe en **mode live** (remplacer `pk_test_` → `pk_live_`)
- [ ] Configurer un vrai domaine dans Vercel (ex: chaletchat.ca)
- [ ] Activer les emails Supabase (SMTP personnalisé)
- [ ] Tester un paiement complet en mode test Stripe
- [ ] Vérifier les politiques RLS dans Supabase
- [ ] Configurer les alertes d'erreur (Sentry ou Vercel Analytics)

---

## 🏗 Structure du projet

```
chaletchat/
├── public/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx          ← Navigation avec état auth
│   │   ├── ProtectedRoute.jsx  ← Garde les routes privées
│   │   ├── Toast.jsx           ← Notifications
│   │   ├── StepIndicator.jsx   ← Indicateur multi-étapes
│   │   ├── PasswordInput.jsx   ← Champ mot de passe + force
│   │   └── UploadBox.jsx       ← Upload documents/photos
│   ├── hooks/
│   │   ├── useAuth.js          ← Auth Supabase (contexte global)
│   │   ├── useChalets.js       ← CRUD chalets
│   │   ├── useRequests.js      ← Demandes + offres + checklist
│   │   └── useToast.js         ← Notifications toast
│   ├── lib/
│   │   ├── supabase.js         ← Client Supabase
│   │   ├── stripe.js           ← Client Stripe
│   │   └── supabase-schema.sql ← Schéma DB complet
│   ├── pages/
│   │   ├── Home.jsx            ← Page d'accueil / landing
│   │   ├── Login.jsx           ← Connexion
│   │   ├── Register.jsx        ← Inscription (proprio 3 étapes / pro 4 étapes)
│   │   ├── Dashboard.jsx       ← Tableau de bord propriétaire
│   │   ├── ProDashboard.jsx    ← Espace professionnel
│   │   └── Paiement.jsx        ← Info paiements & frais
│   ├── App.jsx                 ← Router principal
│   ├── main.jsx                ← Point d'entrée React
│   └── index.css               ← Tailwind + styles globaux
├── .env.example                ← Template variables d'env
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## ❓ Questions fréquentes

**Q : L'inscription créé un utilisateur mais pas de profil ?**
→ Vérifiez que le trigger `on_auth_user_created` s'est bien créé (SQL Editor → re-exécuter le schéma).

**Q : Les images ne s'uploadent pas ?**
→ Vérifiez les politiques Storage dans Supabase → Storage → Policies.

**Q : Stripe retourne une erreur ?**
→ Assurez-vous d'être en mode test et d'utiliser `pk_test_...`.

**Q : Comment ajouter les vraies notifications push ?**
→ Intégrez **OneSignal** ou **Expo** (mobile) — ajoutez la clé dans `.env`.

---

*Généré par ChaletProp Setup Assistant · Version 1.0*
