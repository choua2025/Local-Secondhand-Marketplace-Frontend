# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Build stage — compile and bundle the React app to static files.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* env vars into the bundle AT BUILD TIME — they are compile
# time constants, not runtime config. So the API origin must be known here.
# Vite exposes process.env vars with the VITE_ prefix, so this ARG->ENV is
# enough; it defaults to the local compose setup.
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Runtime stage — nginx serving the static bundle. No Node in the final image.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# SPA routing + asset caching; see the file.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1
