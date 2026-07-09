# Guide de déploiement Paperclip sur Railway

## Vue d'ensemble

Paperclip tournera 24/7 dans le cloud sur Railway, orchestrant 3 agents IA (CEO, Builder, Reviewer) qui codent ChaletProp automatiquement.

## Prérequis

- Un compte GitHub (celui qui a `recd26/chaletchat`)
- Une carte de crédit (pour Railway après le crédit gratuit)
- Une clé API Anthropic

---

## Étape 1 : Créer un compte Railway

1. Allez sur https://railway.app
2. Cliquez **"Start a New Project"**
3. Connectez-vous avec **GitHub**
4. Vous recevez **5$ de crédit gratuit** pour tester

---

## Étape 2 : Récupérer votre clé API Anthropic

1. Allez sur https://console.anthropic.com/
2. Onglet **"API Keys"** → **"Create Key"**
3. Nommez-la `ChaletProp Paperclip`
4. **Copiez la clé** (elle commence par `sk-ant-api03-...`)
5. Gardez-la, on va la coller dans Railway

---

## Étape 3 : Créer un Personal Access Token GitHub

Les agents ont besoin d'accéder à votre repo pour push du code.

1. Allez sur https://github.com/settings/tokens
2. Cliquez **"Generate new token"** → **"Generate new token (classic)"**
3. Nom : `Paperclip Agents`
4. Expiration : `90 days` (ou "No expiration" si vous préférez)
5. Cochez les permissions :
   - ✅ **`repo`** (accès complet aux repos)
   - ✅ **`workflow`** (optionnel, pour les Actions)
6. **"Generate token"** → **Copiez le token** (commence par `ghp_...`)

---

## Étape 4 : Déployer sur Railway

### 4a. Créer le projet

1. Dans Railway, cliquez **"New Project"**
2. **"Deploy from GitHub repo"**
3. Autorisez Railway à accéder à vos repos
4. Sélectionnez `recd26/chaletchat`

### 4b. Configurer le dossier source

Railway va essayer de déployer tout le repo. On veut seulement le sous-dossier `paperclip-server/`.

1. Cliquez sur le service créé
2. **Settings** → **Source**
3. **Root Directory** : `paperclip-server`
4. **Watch Paths** : `paperclip-server/**`
5. Sauvegarder

### 4c. Ajouter la base de données PostgreSQL

1. Dans votre projet Railway (pas le service), cliquez **"+ New"**
2. **"Database"** → **"PostgreSQL"**
3. Railway crée automatiquement une DB
4. La variable `DATABASE_URL` sera **automatiquement injectée** dans votre service Paperclip

### 4d. Configurer les variables d'environnement

Retournez au service Paperclip, **onglet "Variables"** et ajoutez :

| Variable | Valeur | Comment l'obtenir |
|----------|--------|-------------------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Étape 2 |
| `GITHUB_TOKEN` | `ghp_...` | Étape 3 |
| `PAPERCLIP_AGENT_JWT_SECRET` | (secret aléatoire) | Voir ci-dessous |
| `DATABASE_URL` | (auto) | ✅ Déjà injecté par Railway |
| `PORT` | (auto) | ✅ Railway le gère |

**Pour générer `PAPERCLIP_AGENT_JWT_SECRET`** :

Sur votre PC Windows dans CMD :
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copiez la sortie et collez-la comme valeur.

### 4e. Déclencher le premier déploiement

1. **Settings** → **"Redeploy"** ou faites un git push
2. Railway build l'image Docker (~3-5 minutes)
3. Les logs devraient afficher :
   ```
   🚀 Paperclip on Railway — ChaletProp
   ✅ Starting Paperclip on port 8080...
   Server listening on 0.0.0.0:8080
   ```

### 4f. Exposer publiquement (avec mot de passe)

1. **Settings** → **Networking** → **"Generate Domain"**
2. Railway génère une URL du type `paperclip-production.up.railway.app`
3. **IMPORTANT** : cette URL sera publique ! On va sécuriser Paperclip juste après.

---

## Étape 5 : Sécuriser l'accès

Par défaut Paperclip démarre en mode "trusted local". Sur Railway c'est **exposé publiquement**. Il faut activer l'authentification.

### Option A : IP allowlist (le plus simple)

Dans Railway → Service → Settings → Networking :
- **"Private Networking Only"** → activé si vous voulez utiliser Railway CLI pour vous connecter

### Option B : Activer l'auth Paperclip

Ajoutez ces variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `PAPERCLIP_DEPLOY_MODE` | `authenticated` |
| `PAPERCLIP_ADMIN_EMAIL` | votre email |
| `PAPERCLIP_ADMIN_PASSWORD` | un mot de passe fort |

Puis redéployez. Vous devrez vous connecter pour accéder au dashboard.

---

## Étape 6 : Ouvrir le dashboard et créer la company

1. Ouvrez l'URL Railway (ex: `https://paperclip-production.up.railway.app`)
2. Connectez-vous
3. **Create Company** :
   - Nom : `ChaletProp`
   - Mission : `Devenir la plateforme #1 de gestion de ménage pour chalets locatifs au Québec. Connecter propriétaires et professionnels du nettoyage avec un workflow simple : demande → offre → mission → paiement.`

---

## Étape 7 : Créer les 3 agents

Copiez les prompts depuis `AGENTS.md` dans le repo.

### Agent 1 : CEO

| Champ | Valeur |
|-------|--------|
| Name | `ceo` |
| Adapter | `claude-code` |
| Model | `Claude Opus 4.7` |
| Working directory | `/workspace/chaletchat` |
| Heartbeat | `0 */4 * * *` |
| Budget | `30 USD/mois` |

Instructions → coller le prompt du CEO depuis `AGENTS.md`

### Agent 2 : Builder

| Champ | Valeur |
|-------|--------|
| Name | `builder` |
| Adapter | `claude-code` |
| Model | `Claude Opus 4.7` |
| Working directory | `/workspace/chaletchat` |
| Reports to | `ceo` |
| Heartbeat | `*/30 * * * *` |
| Budget | `100 USD/mois` |

Instructions → coller le prompt du Builder depuis `AGENTS.md`

### Agent 3 : Reviewer

| Champ | Valeur |
|-------|--------|
| Name | `reviewer` |
| Adapter | `claude-code` |
| Model | `Claude Opus 4.7` |
| Working directory | `/workspace/chaletchat` |
| Reports to | `ceo` |
| Heartbeat | `*/15 * * * *` |
| Budget | `40 USD/mois` |

Instructions → coller le prompt du Reviewer depuis `AGENTS.md`

---

## Étape 8 : Créer votre première tâche

1. Dans Paperclip, cliquez **"New Issue"**
2. Titre : `Intégrer Stripe réel — remplacer le mock`
3. Description :
   ```
   Le fichier src/components/StripeCardForm.jsx simule les paiements avec un
   setTimeout et retourne un faux paymentMethodId.

   Il faut :
   1. Installer @stripe/stripe-js et @stripe/react-stripe-js
   2. Configurer Stripe Connect pour les pros (recevoir les paiements)
   3. Créer les Edge Functions Supabase pour créer les PaymentIntents
   4. Pré-autoriser la carte à l'acceptation d'offre
   5. Libérer le paiement automatiquement quand la checklist est 100%
   ```
4. Priority : `P0 — Critical`
5. Assign to : `ceo`

Le CEO va se réveiller au prochain heartbeat, décomposer en sous-tâches, et assigner au Builder.

---

## Coûts mensuels estimés

| Service | Coût |
|---------|------|
| **Railway** — Paperclip server | ~5-10$ USD |
| **Railway** — PostgreSQL | ~5$ USD |
| **Anthropic API** — 3 agents Claude Opus | ~80-130$ USD |
| **Total** | **~90-145$ USD/mois** |

Les agents ne coûtent rien quand ils n'ont pas de travail (heartbeat idle).

---

## Dépannage

### Le service ne démarre pas
- Vérifier les logs Railway → Deploy Logs
- Vérifier que `DATABASE_URL` est bien injecté (onglet Variables)
- Vérifier que PostgreSQL est bien démarré (service séparé)

### Les agents ne se réveillent pas
- Vérifier que `ANTHROPIC_API_KEY` est configuré
- Cliquer manuellement **"Wake"** sur l'agent dans le dashboard
- Vérifier les logs de l'agent

### Les agents ne peuvent pas push sur GitHub
- Vérifier que `GITHUB_TOKEN` est valide et a le scope `repo`
- Vérifier que le token n'est pas expiré

### Le domaine Railway ne fonctionne pas
- Attendre 2-3 minutes après "Generate Domain"
- Vérifier dans **Deploy Logs** que le service écoute sur `0.0.0.0` (pas `127.0.0.1`)

---

## Après le déploiement

- Le dashboard Paperclip est accessible depuis n'importe où (mobile, ordinateur)
- Les agents travaillent 24/7 même quand vous dormez
- Vous recevez des notifications quand une PR est prête à review
- Vous approuvez les changements depuis votre téléphone

Vous êtes maintenant CEO d'une entreprise autonome ! 🚀
