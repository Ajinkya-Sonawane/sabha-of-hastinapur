# Build stage: full Node image with npm. None of it ships.
FROM node:22-trixie-slim AS build

WORKDIR /app

# Manifests first so the dependency layer is cached across source edits.
COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/game-engine/package.json packages/game-engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev

# Runtime stage: distroless has no shell, package manager or npm, which keeps
# the OS-level CVE surface near zero. It runs as the unprivileged "nonroot" user.
FROM gcr.io/distroless/nodejs22-debian13:nonroot

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Owned by nonroot so Next.js can write its cache under .next/.
COPY --from=build --chown=65532:65532 /app /app

WORKDIR /app/apps/server
EXPOSE 3000

# The image's entrypoint is node itself.
CMD ["--import", "tsx", "src/index.ts"]
