# ─── Stage 1: Install dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Generate Prisma client ──────────────────────────────────────
FROM node:20-alpine AS prisma
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma

RUN npx prisma generate --schema=prisma/schema.prisma

# ─── Stage 3: TypeScript build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY shared ./shared
COPY src ./src
COPY tsconfig.json ./

RUN npx tsc

# ─── Stage 4: Production image ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api
USER api

# Copy production dependencies
COPY --from=deps --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=prisma --chown=api:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy shared source (runtime dependency)
COPY --chown=api:nodejs shared ./shared

# Copy compiled TypeScript output
COPY --chown=api:nodejs --from=builder /app/dist ./dist
COPY --chown=api:nodejs package.json ./
COPY --chown=api:nodejs prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/ready || exit 1

CMD ["node", "dist/server.js"]
