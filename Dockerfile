# syntax=docker/dockerfile:1
# Single-container deploy: the Hono API also serves the Expo web export.

# ---- Stage 1: export the Expo app as a static web build ----
FROM node:22-slim AS web
ENV CI=1
WORKDIR /build/app
COPY app/package.json app/package-lock.json app/.npmrc ./
RUN npm ci
COPY app/ ./
RUN npx expo export --platform web && node scripts/postexport.mjs

# ---- Stage 2: API server + static files ----
FROM node:22-slim
# Prisma's query engine links against OpenSSL.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
# Shared types live inside the app package (Metro constraint); the server
# imports them at runtime, so the directory layout must match the repo.
COPY app/shared /app/app/shared
COPY server/ ./
# The client generated on the host is platform-specific — regenerate for Linux.
RUN npx prisma generate
COPY --from=web /build/app/dist ./public

ENV NODE_ENV=production
# Mount a persistent volume at /data or the database resets on each deploy.
ENV DATABASE_URL="file:/data/now.db"

# `db push` is idempotent: it creates/updates the sqlite schema on boot.
# --accept-data-loss lets db push apply destructive schema changes (e.g. a
# dropped model) non-interactively; without it the boot aborts and the
# healthcheck never comes up on a volume that still has the old tables.
CMD ["sh", "-c", "mkdir -p /data && npx prisma db push --skip-generate --accept-data-loss && npm start"]
