# MapaImprez Event Engine — one image, roles selected by ENGINE_ROLE.
# Build from the repository root:  docker build -f engine/deploy/Dockerfile -t mapaimprez-engine .
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

WORKDIR /app

# Only the runtime dependency the engine needs (Supabase client) — not the Next.js app.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts \
 && npm cache clean --force

COPY database.types.ts ./database.types.ts
COPY engine/package.json engine/tsconfig.json ./engine/
COPY engine/src ./engine/src
COPY engine/data ./engine/data

RUN mkdir -p /data /backups && chown -R node:node /data /backups
USER node

ENV ENGINE_DATA_DIR=/data \
    ENGINE_DB_PATH=/data/engine.sqlite \
    ENGINE_BACKUP_DIR=/backups \
    ENGINE_KILL_FILE=/data/KILL

HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ENGINE_HEALTH_PORT||'8787')+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "engine/src/main.ts"]
CMD ["run"]
