# --- Stage 1: Build ---
FROM node:20-alpine AS builder

# 1. Enable Corepack and bake in pnpm version to avoid runtime downloads
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# 2. Copy root configurations for the monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json* ./

# 3. Copy shared packages and the api app
COPY packages ./packages
COPY apps/api ./apps/api

# 4. Install all dependencies (caching the pnpm store for speed)
RUN pnpm install --frozen-lockfile

# 5. Optional: If you need to build/transpile your code before running
# RUN pnpm --filter api build

# --- Stage 2: Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

# 6. Re-enable Corepack in the final image
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 7. Prevent Corepack from ever prompting for a download (headless safety)
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=production
ENV PORT=4000

# 8. Copy the entire built workspace from the builder
COPY --from=builder /app /app

WORKDIR /app/apps/api

EXPOSE 4000

# 9. Startup Command: Migrates, Seeds, then Starts the API
# Sequential execution ensures the app doesn't start if migrations fail.
CMD ["sh", "-c", "pnpm exec tsx src/infra/http/index.ts"]
