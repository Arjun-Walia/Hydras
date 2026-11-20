# Hydras sync server (Hocuspocus + SQLite). Build from the repo root:
#   docker build -f apps/server/Dockerfile -t hydras-sync .
#   docker run -p 8080:8080 -v hydras-data:/data hydras-sync

FROM node:24-bookworm-slim AS deps
# better-sqlite3 uses a prebuilt binary when one exists; these are the fallback toolchain.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @hydras/server...

FROM node:24-bookworm-slim
RUN corepack enable && useradd --create-home --uid 10001 hydras \
  && mkdir -p /data && chown hydras /data
WORKDIR /app
COPY --from=deps /app ./
COPY apps/server/src apps/server/src
COPY apps/server/tsconfig.json apps/server/
ENV NODE_ENV=production \
    PORT=8080 \
    SQLITE_PATH=/data/hydras.sqlite
USER hydras
EXPOSE 8080
VOLUME ["/data"]
CMD ["node_modules/.bin/tsx", "apps/server/src/index.ts"]
