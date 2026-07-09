FROM node:22-slim

WORKDIR /app

# Installer git et bash (requis pour Paperclip et les agents)
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Installer Paperclip globalement
RUN npm install -g paperclipai@latest

# Installer Claude Code CLI pour les agents
RUN npm install -g @anthropic-ai/claude-code

# Créer les dossiers de configuration et données
RUN mkdir -p /root/.paperclip /workspace

# Exposer le port (Railway injectera son propre PORT)
EXPOSE 3100

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PAPERCLIP_HOME=/root/.paperclip

# Configuration git de base (nécessaire pour les commits des agents)
RUN git config --global user.email "paperclip-agents@chaletprop.com" && \
    git config --global user.name "Paperclip Agents" && \
    git config --global init.defaultBranch main

# Copier le script de démarrage
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Lancer Paperclip via le script
CMD ["/start.sh"]
