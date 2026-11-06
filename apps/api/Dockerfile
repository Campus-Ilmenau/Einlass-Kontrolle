# syntax=docker/dockerfile:1
# API-Image (Build-Kontext: Repository-Wurzel)
#   docker build -f apps/api/Dockerfile -t einlass-api .

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
RUN corepack enable
WORKDIR /app
# Nur die Manifeste → Abhängigkeiten werden gecacht, solange sich der Lockfile nicht ändert
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# ─── Build: TypeScript → JavaScript ────────────────────────────────────────
FROM base AS build
# --no-optional: keine Plattform-Binaries (Postgres für Tests, esbuild) – tsc braucht sie nicht
RUN pnpm install --frozen-lockfile --no-optional --filter "@einlass/api..."
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @einlass/shared build && pnpm --filter @einlass/api build

# ─── Nur Laufzeit-Abhängigkeiten ───────────────────────────────────────────
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod --filter "@einlass/api..."

# ─── Laufzeit-Image ────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist

USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
