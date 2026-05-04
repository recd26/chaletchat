# Guide d'installation — Paperclip + ChaletProp

## Prérequis

- **Node.js 20+** — [nodejs.org](https://nodejs.org/)
- **pnpm 9.15+** — `npm install -g pnpm`
- **Git** — installé
- **Clé API Anthropic** — [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create Key

Vérifiez :
```bash
node --version    # v20+ requis
pnpm --version    # 9.15+ requis
git --version
```

---

## Étape 1 : Cloner le repo ChaletProp

```bash
git clone https://github.com/recd26/chaletchat.git
cd chaletchat
```

---

## Étape 2 : Installer Paperclip

```bash
npx paperclipai onboard --yes
```

Ça va :
- Créer le dossier `~/.paperclip/`
- Configurer une base de données PostgreSQL embarquée (rien à installer)
- Générer les clés de sécurité
- Configurer le serveur sur `http://localhost:3100`

---

## Étape 3 : Lancer Paperclip

```bash
npx paperclipai run
```

Vous devriez voir :
```
✓ Database ready
✓ Server listening on http://127.0.0.1:3100
```

Ouvrez **http://localhost:3100** dans votre navigateur. Vous verrez le dashboard Paperclip.

> **Laisser ce terminal ouvert** — Paperclip tourne en arrière-plan.

---

## Étape 4 : Créer la company "ChaletProp"

Dans le dashboard Paperclip (http://localhost:3100) :

1. Cliquez **"Create Company"**
2. Nom : `ChaletProp`
3. Mission : `Devenir la plateforme #1 de gestion de ménage pour chalets locatifs au Québec`
4. Cliquez **"Create"**

---

## Étape 5 : Configurer la clé API Anthropic

Les agents utilisent Claude Code, qui a besoin de votre clé API Anthropic.

### Option A : Variable d'environnement (recommandé)

Ajoutez dans votre fichier `~/.zshrc` ou `~/.bashrc` :
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-VOTRE-CLE-ICI"
```

Puis rechargez :
```bash
source ~/.zshrc  # ou source ~/.bashrc
```

### Option B : Via Paperclip Secrets

Dans le dashboard Paperclip :
1. Allez dans **Settings → Secrets**
2. Ajoutez `ANTHROPIC_API_KEY` avec votre clé

---

## Étape 6 : Créer les 3 agents

### Agent 1 : CEO / Product Manager

Dans le dashboard Paperclip :
1. Allez dans la company **ChaletProp**
2. Cliquez **"Hire Agent"** (ou "Add Agent")
3. Remplissez :

| Champ | Valeur |
|-------|--------|
| Name | `ceo` |
| Title | `Product Manager` |
| Role | `executive` |
| Adapter | `claude-code` |
| Reports to | Board (vous) |
| Heartbeat | `0 */4 * * *` (toutes les 4 heures) |
| Monthly budget | `30 USD` |

4. Dans **Instructions**, collez le prompt du CEO depuis `AGENTS.md`
5. Cliquez **"Hire"**

### Agent 2 : Feature Builder

1. Cliquez **"Hire Agent"**
2. Remplissez :

| Champ | Valeur |
|-------|--------|
| Name | `builder` |
| Title | `Développeur Principal` |
| Role | `engineer` |
| Adapter | `claude-code` |
| Reports to | `ceo` |
| Heartbeat | `*/30 * * * *` (toutes les 30 minutes) |
| Monthly budget | `100 USD` |
| Workspace | Chemin vers votre repo chaletchat (ex: `/Users/david/chaletchat`) |

3. Collez le prompt du Builder depuis `AGENTS.md`
4. Cliquez **"Hire"**

### Agent 3 : Code Reviewer

1. Cliquez **"Hire Agent"**
2. Remplissez :

| Champ | Valeur |
|-------|--------|
| Name | `reviewer` |
| Title | `Code Reviewer Senior` |
| Role | `engineer` |
| Adapter | `claude-code` |
| Reports to | `ceo` |
| Heartbeat | `*/15 * * * *` (toutes les 15 minutes) |
| Monthly budget | `40 USD` |

3. Collez le prompt du Reviewer depuis `AGENTS.md`
4. Cliquez **"Hire"**

---

## Étape 7 : Configurer le workspace (repo Git)

1. Dans Paperclip, allez dans **Projects**
2. Créez un projet **"ChaletProp App"**
3. Configurez le workspace :
   - **Path** : le chemin local vers votre repo (ex: `/Users/david/chaletchat`)
   - **Branch strategy** : les agents travaillent sur des branches séparées
4. Associez les 3 agents au projet

---

## Étape 8 : Créer votre première tâche

1. Dans le projet ChaletProp, créez un **Issue** (tâche) :
   - Titre : `Intégrer Stripe réel — remplacer le mock`
   - Description : `Le fichier StripeCardForm.jsx simule les paiements avec un setTimeout. Il faut implémenter la vraie intégration Stripe avec Stripe Connect pour les pros.`
   - Priority : `P0 — Critical`
   - Assign to : `ceo`

2. Le CEO va :
   - Recevoir la tâche à son prochain heartbeat (max 4h, ou déclenchez manuellement)
   - Décomposer en sous-tâches
   - Assigner les sous-tâches au Builder

3. Le Builder va :
   - Coder chaque sous-tâche
   - Créer des PRs

4. Le Reviewer va :
   - Détecter les nouvelles PRs
   - Faire une review automatique
   - Approuver ou demander des changements

---

## Commandes utiles

```bash
# Lancer Paperclip
npx paperclipai run

# Reconfigurer
npx paperclipai configure

# Vérifier la santé
npx paperclipai doctor

# Déclencher manuellement un heartbeat d'un agent
# (depuis le dashboard, cliquer "Wake" sur l'agent)
```

---

## Coûts estimés

| Agent | Heartbeats/jour | Coût estimé/mois |
|-------|----------------|------------------|
| CEO | 6 | ~10-20 USD |
| Builder | 48 | ~50-80 USD |
| Reviewer | 96 | ~20-30 USD |
| **Total** | | **~80-130 USD/mois** |

> Les heartbeats ne coûtent rien si l'agent n'a pas de travail — il vérifie
> sa boîte de réception et se rendort immédiatement.

---

## Architecture finale

```
┌─────────────────────────────────────────┐
│           PAPERCLIP (localhost:3100)     │
│                                         │
│  Board (vous) ──► CEO ──┬──► Builder    │
│                         └──► Reviewer   │
│                                         │
│  Projet: ChaletProp App                 │
│  Workspace: ~/chaletchat                │
│  Git: github.com/recd26/chaletchat      │
└─────────────────────────────────────────┘
         │              │
         ▼              ▼
  ┌─────────────┐ ┌──────────┐
  │   Vercel    │ │ Supabase │
  │ (déploie    │ │ (base de │
  │  auto sur   │ │  données │
  │  push main) │ │  + auth) │
  └─────────────┘ └──────────┘
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `EACCES` sur PostgreSQL | `chmod +x ~/.paperclip/instances/default/db/bin/*` |
| Port 3100 déjà utilisé | `npx paperclipai configure` → changer le port |
| Agent ne se réveille pas | Vérifiez le heartbeat cron + cliquez "Wake" manuellement |
| Clé API non trouvée | Vérifiez `echo $ANTHROPIC_API_KEY` dans le terminal |
| Budget dépassé | Augmentez dans Settings → Agents → Budget |
