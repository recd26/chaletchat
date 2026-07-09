#!/bin/bash
set -e

echo "==================================="
echo "🚀 Paperclip on Railway — ChaletProp"
echo "==================================="

# Vérifier les variables d'environnement requises
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set. Paperclip needs PostgreSQL."
  echo "   Add a PostgreSQL service in Railway and it will be injected automatically."
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  ANTHROPIC_API_KEY not set. Agents won't work."
  echo "   Add it in Railway → Variables tab."
fi

if [ -z "$PAPERCLIP_AGENT_JWT_SECRET" ]; then
  echo "⚠️  PAPERCLIP_AGENT_JWT_SECRET not set. Generating one for this session..."
  export PAPERCLIP_AGENT_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
fi

# Cloner le repo ChaletProp comme workspace des agents
if [ ! -d "/workspace/chaletchat" ] && [ -n "$GITHUB_TOKEN" ]; then
  echo "📦 Cloning ChaletProp repo as agent workspace..."
  cd /workspace
  git clone https://x-access-token:${GITHUB_TOKEN}@github.com/recd26/chaletchat.git
  cd chaletchat
  git config --local user.email "paperclip-agents@chaletprop.com"
  git config --local user.name "Paperclip Agents"
fi

# Utiliser le PORT de Railway ou 3100 par défaut
export PORT="${PORT:-3100}"

echo "✅ Starting Paperclip on port $PORT..."
echo "==================================="

# Onboarder si pas encore fait (idempotent)
if [ ! -f "/root/.paperclip/instances/default/config.json" ]; then
  echo "🔧 First run — running onboard..."
  npx paperclipai onboard --yes --bind lan
fi

# Lancer Paperclip
exec npx paperclipai run --bind 0.0.0.0
