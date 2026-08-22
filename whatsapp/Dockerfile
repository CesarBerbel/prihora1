# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl
COPY package.json package-lock.json* ./

FROM base AS dev
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM base AS prod
# su-exec larga o privilegio depois de o entrypoint acertar a posse do volume.
RUN apk add --no-cache su-exec
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .

# Nao usamos USER: o entrypoint comeca como root apenas para corrigir o dono do
# volume de sessoes e so depois passa a este utilizador. Ver docker-entrypoint.sh.
RUN addgroup -g 10001 -S prihora && adduser -u 10001 -S prihora -G prihora \
 && mkdir -p /data/sessions \
 && chown -R prihora:prihora /app /data \
 && chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health >/dev/null || exit 1

CMD ["node", "src/server.js"]
