# syntax=docker/dockerfile:1
# Static single-container deploy: the Expo web export served as an SPA.
# Fully client-direct to Supabase — no Hono API, no SQLite, no volume.

# ---- Stage 1: export the Expo app as a static web build ----
FROM node:22-slim AS web
ENV CI=1
WORKDIR /build/app
COPY app/package.json app/package-lock.json app/.npmrc ./
RUN npm ci
COPY app/ ./
# Supabase public config is inlined into the JS bundle at build time.
# The anon key is public by design (Row-Level Security + RPCs protect the data).
ENV EXPO_PUBLIC_SUPABASE_URL=https://bhxlhjnaoktjmtuggzog.supabase.co
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoeGxoam5hb2t0am10dWdnem9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMjY5MTgsImV4cCI6MjA5ODcwMjkxOH0.9fjbMIfwBpzaKxTAUbFg7IhCZHEqrOF7fLZaka4z3ps
RUN npm run export:web

# ---- Stage 2: serve the static SPA ----
FROM node:22-slim
RUN npm install -g serve@14
WORKDIR /site
COPY --from=web /build/app/dist ./dist
ENV PORT=8080
EXPOSE 8080
# -s = SPA fallback: serve index.html for client-side routes (/welcome, /e/:slug, …)
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
