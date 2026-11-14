# -----------------------------------------------------------------------------
# Al Ramlah Travels — Production Multi-Stage Dockerfile
# Hardened for Next.js 16.4+ App Router standalone deployment on Node.js 22 LTS
# -----------------------------------------------------------------------------

# Stage 1: Base image (Active/Maintenance LTS)
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat tini

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 3: Build application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL=https://alramlahtravels.com
ARG R2_PUBLIC_URL=https://assets.alramlahtravels.com

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV R2_PUBLIC_URL=${R2_PUBLIC_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN test -n "$NEXT_PUBLIC_APP_URL" && \
    case "$NEXT_PUBLIC_APP_URL" in *localhost*|*127.0.0.1*) echo "ERROR: NEXT_PUBLIC_APP_URL must not be localhost in production image" && exit 1 ;; esac && \
    npm run build

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and compiled standalone server with non-root ownership
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
