# ============================================================
# BygSmart 2.0 - Multi-stage Docker build
# Stage 1: Build the Vite app
# Stage 2: Serve with Nginx
# ============================================================

# --- Stage 1: Build ---
# Base image pinned by digest (node:20-alpine) for reproducible, tamper-evident builds.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts

# Copy source and build (env vars injected at build time via --build-arg)
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_DROPBOX_CLIENT_ID
ARG VITE_ONEDRIVE_CLIENT_ID
ARG VITE_BOX_CLIENT_ID
ARG VITE_APP_NAME
ARG VITE_SENTRY_DSN
ARG VITE_PUBLIC_BASE_PATH

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_DROPBOX_CLIENT_ID=$VITE_DROPBOX_CLIENT_ID
ENV VITE_ONEDRIVE_CLIENT_ID=$VITE_ONEDRIVE_CLIENT_ID
ENV VITE_BOX_CLIENT_ID=$VITE_BOX_CLIENT_ID
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_PUBLIC_BASE_PATH=$VITE_PUBLIC_BASE_PATH

RUN npm run build

# --- Stage 2: Serve ---
# Base image pinned by digest (nginx:stable-alpine).
FROM nginx:stable-alpine@sha256:0d3b80406a13a767339fbe2f41406d6c7da727ab89cf8fae399e81f780f814d1

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config (HTTP only; SSL is handled by host Nginx proxy)
COPY deploy/nginx-docker.conf /etc/nginx/conf.d/bygsmart.conf

# Copy built files to the default Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# --- Hardening: drop root, keep listening on :80 ---
# The base image already ships a non-root "nginx" user (uid 101). Grant the
# nginx binary the capability to bind the privileged port 80, then hand the
# runtime-writable paths (temp cache + pid file) to that user so the master
# process can run unprivileged. setcap's file capability survives removing the
# libcap helper, so the final image carries no extra packages.
RUN apk add --no-cache libcap \
 && setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx \
 && apk del libcap \
 && touch /run/nginx.pid \
 && chown -R nginx:nginx /var/cache/nginx /run/nginx.pid /usr/share/nginx/html

USER nginx

EXPOSE 80

# Liveness: nginx must answer the SPA index over HTTP
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
