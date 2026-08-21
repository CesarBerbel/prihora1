# syntax=docker/dockerfile:1
# ------------------------------------------------------------------ base ----
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ------------------------------------------------------------------- deps ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# -------------------------------------------------------------------- dev ---
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ------------------------------------------------------------------ build ---
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=/
ARG NEXT_PUBLIC_SITE_NAME=prihora
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ------------------------------------------------------------------- prod ---
FROM base AS prod
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 10001 -S prihora && adduser -u 10001 -S prihora -G prihora

COPY --from=build /app/public ./public
COPY --from=build --chown=prihora:prihora /app/.next/standalone ./
COPY --from=build --chown=prihora:prihora /app/.next/static ./.next/static

USER prihora
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
