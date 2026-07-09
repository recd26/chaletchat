FROM node:22-slim

WORKDIR /app

# Installer git et bash (requis pour Paperclip et les agents)
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    ca-certificates \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Installer Paperclip globalement
RUN npm install -g paperclipai@latest

# Installer Claude Code CLI pour les agents
RUN npm install -g @anthropic-ai/claude-code

# Créer un utilisateur non-root pour que Claude Code puisse tourner
# (Claude Code refuse --dangerously-skip-permissions en root)
RUN useradd -m -s /bin/bash paperclip && \
    mkdir -p /home/paperclip/.paperclip /workspace && \
    chown -R paperclip:paperclip /home/paperclip /workspace /app

# Configuration git de base
RUN git config --global user.email "paperclip-agents@chaletprop.com" && \
    git config --global user.name "Paperclip Agents" && \
    git config --global init.defaultBranch main

USER paperclip
RUN git config --global user.email "paperclip-agents@chaletprop.com" && \
    git config --global user.name "Paperclip Agents" && \
    git config --global init.defaultBranch main

# Exposer le port
EXPOSE 3100

# Variables d'environnement
ENV NODE_ENV=production
ENV PAPERCLIP_HOME=/home/paperclip/.paperclip
ENV HOME=/home/paperclip

# Copier le script de démarrage
COPY --chown=paperclip:paperclip start.sh /home/paperclip/start.sh
USER root
RUN chmod +x /home/paperclip/start.sh
USER paperclip

# Lancer Paperclip via le script en tant qu'utilisateur non-root
CMD ["/home/paperclip/start.sh"]
