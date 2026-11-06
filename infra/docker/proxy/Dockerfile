# syntax=docker/dockerfile:1
# Reverse-Proxy mit Web-App (Build-Kontext: Repository-Wurzel)
# TLS mit dem self-signed Zertifikat des Pi, /api → API-Container, / → Web-App (SPA).

ARG NODE_IMAGE=node:24-alpine

# ─── Web-App bauen ─────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS web
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Optionale Pakete werden gebraucht (Rolldown/Vite bringt plattformspezifische Binaries mit)
RUN pnpm install --frozen-lockfile --filter "@einlass/web..."
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @einlass/shared build && pnpm --filter @einlass/web build

# ─── nginx ─────────────────────────────────────────────────────────────────
FROM nginx:1.29-alpine
COPY infra/docker/proxy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /app/apps/web/dist/ /usr/share/nginx/html/
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
