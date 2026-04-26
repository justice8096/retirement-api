# ─── Stage 1: Install dependencies ─────────────────────────────────────────
# Base image is digest-pinned to block silent drift. Dependabot's `docker`
# ecosystem monitor will open a PR when a new digest ships for the same tag.
# To refresh manually:
#   docker buildx imagetools inspect node:25-alpine --format '{{json .Manifest.Digest}}'
# and replace the sha256 below with the new value across all four FROM lines.
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# `--ignore-scripts` is required: package.json has a `postinstall` that runs
# `prisma generate --schema=prisma/schema.prisma`, but the prisma/ directory
# is not copied into this stage. Stage 2 handles `prisma generate` explicitly
# after copying the schema, so skipping postinstall here is safe.
RUN npm ci --ignore-scripts

# ─── Stage 2: Generate Prisma client ──────────────────────────────────────
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS prisma
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
# Prisma 7 loads its CLI config (including the datasource URL for
# `prisma generate` / `prisma migrate`) from prisma.config.ts at repo
# root — copy it into the build stage so the generate step can find it.
COPY prisma.config.ts tsconfig.json package.json ./

RUN npx prisma generate --schema=prisma/schema.prisma

# ─── Stage 3: TypeScript build ────────────────────────────────────────────
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY shared ./shared
COPY src ./src
COPY tsconfig.json ./

RUN npx tsc

# ─── Stage 4: Production image ────────────────────────────────────────────
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS runner
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
  CMD wget -q --spider http://localhost:3000/api/health/ready || exit 1

CMD ["node", "dist/server.js"]
