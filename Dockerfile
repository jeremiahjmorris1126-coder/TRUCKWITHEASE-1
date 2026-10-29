# Stage 1: Build & bundle Vite frontend + Node Express backend
FROM node:22-alpine3.21 AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy full application source
COPY . .

# Build Vite frontend & bundle server.ts into dist/server.cjs
RUN npm run build

# Stage 2: Minimal production runtime (non-root)
FROM node:22-alpine3.21 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Patch Alpine OS packages to the latest security fixes
RUN apk upgrade --no-cache

# Install production-only dependencies, then strip the package managers
# (npm, npx, corepack, yarn) bundled in the base image. They are not needed
# at runtime and their own bundled deps are a common source of CVE findings.
COPY package*.json ./
RUN npm install --omit=dev \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm \
            /usr/local/lib/node_modules/corepack \
            /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
            /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Copy compiled artifacts from builder stage with proper ownership
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public

# Run as non-root node user (provided by official Node image)
USER node

EXPOSE 8080

# Cloud Run binds to process.env.PORT automatically
CMD ["node", "dist/server.cjs"]
