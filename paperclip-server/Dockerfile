FROM node:22-slim

WORKDIR /app

# Installer git et bash (requis pour Paperclip et les agents)
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    ca-certificates \
    sudo \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Installer Paperclip globalement (SKIP les binaires PostgreSQL embarqués — on utilise DATABASE_URL)
ENV npm_config_paperclipai__skip_embedded_postgres=true
RUN npm install -g paperclipai@latest --omit=optional && npm cache clean --force

# Installer Claude Code CLI pour les agents
RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force

# Créer un utilisateur non-root pour que Claude Code puisse tourner
RUN useradd -m -s /bin/bash paperclip && \
    mkdir -p /home/paperclip/.paperclip /workspace && \
    chown -R paperclip:paperclip /home/paperclip /workspace /app

# Configuration git de base (root)
RUN git config --global user.email "paperclip-agents@chaletprop.com" && \
    git config --global user.name "Paperclip Agents" && \
    git config --global init.defaultBranch main

USER paperclip

# Configuration git pour l'utilisateur paperclip
RUN git config --global user.email "paperclip-agents@chaletprop.com" && \
    git config --global user.name "Paperclip Agents" && \
    git config --global init.defaultBranch main

# Exposer le port
EXPOSE 3100

# Variables d'environnement
ENV NODE_ENV=production
ENV PAPERCLIP_HOME=/home/paperclip/.paperclip
ENV HOME=/home/paperclip

# Optimisation mémoire Node.js — limite la RAM à 1.5 GB pour laisser de la place aux enfants
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Copier le script de démarrage
COPY --chown=paperclip:paperclip start.sh /home/paperclip/start.sh
USER root
RUN chmod +x /home/paperclip/start.sh
USER paperclip

# Lancer Paperclip via le script en tant qu'utilisateur non-root
CMD ["/home/paperclip/start.sh"]
