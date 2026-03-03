# --- Stage 1: Dependencies ---
FROM node:21-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml kysely.config.ts ./
RUN pnpm install --frozen-lockfile

# --- Stage 2: Runner ---
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json kysely.config.ts ./
COPY src ./src

USER nodeuser

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE $PORT

CMD ["sh", "-c", "pnpm run db:migrate && pnpm start"]

