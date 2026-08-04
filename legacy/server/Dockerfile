# ============================================================
# BygSmart API — Express server (Node 20, hardened, non-root)
# Base image pinned by digest for reproducible, tamper-evident builds.
# ============================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

# Install production deps only, without running lifecycle scripts.
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Application source (owned by the non-root runtime user).
COPY --chown=node:node . .

# Ensure the workdir itself is owned by the non-root user.
RUN chown node:node /app

# Drop root — the base image ships an unprivileged "node" user (uid 1000).
USER node

EXPOSE 3001

# Liveness: the API exposes an unauthenticated /api/health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
