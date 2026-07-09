# Paperclip Server pour ChaletProp — Déploiement Railway

Ce dossier contient la configuration pour héberger Paperclip sur Railway.

## Fichiers

- `Dockerfile` — Image Docker basée sur Node.js 22 avec Paperclip + Claude Code CLI
- `start.sh` — Script de démarrage qui configure Paperclip au premier lancement
- `railway.json` — Configuration Railway (build + healthcheck)

## Guide de déploiement sur Railway

Voir le fichier `../GUIDE-RAILWAY.md` à la racine du repo pour les instructions complètes.

## Résumé rapide

1. Créer un compte sur https://railway.app
2. New Project → Deploy from GitHub repo → `recd26/chaletchat`
3. Ajouter un service PostgreSQL (`+ New` → `Database` → `PostgreSQL`)
4. Configurer les variables d'environnement :
   - `ANTHROPIC_API_KEY` = votre clé API Anthropic
   - `GITHUB_TOKEN` = un Personal Access Token GitHub (scope: repo)
   - `PAPERCLIP_AGENT_JWT_SECRET` = généré aléatoirement
5. Dans les settings du service, définir `Root Directory` = `paperclip-server`
6. Railway va build et déployer automatiquement
7. Ouvrir l'URL fournie par Railway (ex: `paperclip-production.up.railway.app`)
