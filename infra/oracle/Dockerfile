# syntax=docker/dockerfile:1
# One image serves web, API, migrations and scheduled jobs through Compose commands.
ARG NODE_IMAGE=node:24-bookworm-slim
ARG API_URL=http://api:8787

FROM ${NODE_IMAGE} AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.19.0 \
    && npm cache clean --force
WORKDIR /app

FROM base AS build
COPY . .
# Keep development dependencies: API and migration/job runners require tsx.
RUN pnpm install --frozen-lockfile --prod=false
ARG API_URL
# The normal vinext build bakes this internal Docker DNS target into API rewrites.
RUN NODE_ENV=production API_URL="${API_URL}" CLOUDFLARE_BUILD=0 \
    pnpm --filter @lifesync/web build

FROM base AS runtime
ARG API_URL
ENV NODE_ENV=production \
    API_URL=${API_URL} \
    PORT=3000
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000 8787
# vinext 1.0.1 uses --hostname for production start; --host is a dev flag.
CMD ["pnpm", "--filter", "@lifesync/web", "exec", "vinext", "start", "--hostname", "0.0.0.0", "--port", "3000"]
